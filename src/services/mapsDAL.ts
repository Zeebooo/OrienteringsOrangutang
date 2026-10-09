import { supabase } from '@/lib/supabase';
import type { Control, Difficulty, OMap, Terrain } from '@/types';
import { bboxCenter, courseLengthInMeters } from '@/utilities/geo';

// ─── Typer ────────────────────────────────────────────────────────────────

/** En rad i tabellen `maps`, med kolumnnamnen som i databasen. Används bara i den här filen. */
type MapRow = {
	id: string;
	owner_id: string;
	name: string;
	description: string;
	difficulty: Difficulty;
	controls: Control[];
	distance: number | null;
	center_lat: number;
	center_lng: number;
	isPrivate: boolean;
};

export type MapState = 'not_started' | 'started' | 'completed';

export type MapWithState = OMap & { state: MapState };

/** En karta där terrängen garanterat finns, för kartskärmen. */
export type MapWithTerrain = OMap & { terrain: Terrain };

/** Det man skickar in när man skapar en karta. Allt annat räknas ut. */
export type NewMap = {
	name: string;
	description: string;
	difficulty: Difficulty;
	controls: Control[];
	terrain: Terrain;
	isPrivate: boolean;
};

// Kolumnerna i `maps`. Skrivs ut i stället för '*' så att det syns exakt vad som hämtas.
const MAP_COLUMNS = 'id, owner_id, name, description, difficulty, controls, distance, center_lat, center_lng, isPrivate';

// ─── Omvandling databas → app ─────────────────────────────────────────────

function toMap(row: MapRow): OMap {
	return {
		id: row.id,
		ownerId: row.owner_id,
		name: row.name,
		description: row.description,
		difficulty: row.difficulty,
		controls: row.controls,
		distanceM: row.distance,
		center: { latitude: row.center_lat, longitude: row.center_lng },
		isPrivate: row.isPrivate,
	};
}

function getMapState(runs: { completed: boolean }[]): MapState {
	if (runs.some((r) => r.completed)) return 'completed';
	if (runs.length > 0) return 'started';
	return 'not_started';
}

// ─── Läsa ─────────────────────────────────────────────────────────────────

/** Alla kartor med den inloggade användarens status – för flikarna. Ingen terräng följer med. */
export async function fetchMaps(userId: string): Promise<MapWithState[]> {
	const { data, error } = await supabase
		.from('maps')
		.select(`${MAP_COLUMNS}, runs(completed)`)
		.eq('runs.user_id', userId)
		// Andras privata kartor visas inte. Det riktiga skyddet är RLS-regeln på maps – det här är en extra spärr.
		.or(`isPrivate.eq.false,owner_id.eq.${userId}`);

	if (error) throw error;

	return data.map((row) => ({
		...toMap(row as MapRow),
		state: getMapState(row.runs ?? []),
	}));
}

/** Kartor som en viss användare har skapat, i bokstavsordning. Ingen terräng följer med. */
export async function fetchMapsByOwner(ownerId: string): Promise<OMap[]> {
	const { data, error } = await supabase
		.from('maps')
		.select(MAP_COLUMNS)
		.eq('owner_id', ownerId)
		.order('name');

	if (error) throw error;
	return data.map((row) => toMap(row as MapRow));
}

/** En enskild karta utan terräng, t.ex. för ett infokort. */
export async function fetchMapById(mapId: string): Promise<OMap | null> {
	const { data, error } = await supabase
		.from('maps')
		.select(MAP_COLUMNS)
		.eq('id', mapId)
		.maybeSingle();

	if (error) throw error;
	return data ? toMap(data as MapRow) : null;
}

/** Bara terrängen för en karta. */
export async function fetchTerrain(mapId: string): Promise<Terrain> {
	const { data, error } = await supabase
		.from('map_terrain')
		.select('terrain')
		.eq('map_id', mapId)
		.single();

	if (error) throw error;
	return data.terrain as Terrain;
}

/** Kartan från `maps` och dess terräng från `map_terrain` – för kartskärmen. */
export async function fetchMapWithTerrain(mapId: string): Promise<MapWithTerrain | null> {
	
	const [mapResult, terrainResult] = await Promise.all([
		supabase.from('maps').select(MAP_COLUMNS).eq('id', mapId).maybeSingle(),
		supabase.from('map_terrain').select('terrain').eq('map_id', mapId).maybeSingle(),
	]);

	if (mapResult.error) throw mapResult.error;
	if (terrainResult.error) throw terrainResult.error;

	if (!mapResult.data) return null; // kartan finns inte
	if (!terrainResult.data) throw new Error('Kartan saknar terräng');

	return {
		...toMap(mapResult.data as MapRow),
		terrain: terrainResult.data.terrain as Terrain,
	};
}

// ─── Skriva ───────────────────────────────────────────────────────────────

/** Skapar en karta: först raden i `maps`, sedan terrängen i `map_terrain`. */
export async function createMap(input: NewMap): Promise<OMap> {
	const center = bboxCenter(input.terrain.bbox);

	const { data, error } = await supabase
		.from('maps')
		.insert({
			name: input.name,
			description: input.description,
			difficulty: input.difficulty,
			controls: input.controls,
			// Räknas ut här och skrivs aldrig för hand, så de kan inte bli fel
			center_lat: center.latitude,
			center_lng: center.longitude,
			distance: courseLengthInMeters(input.controls),
			isPrivate: input.isPrivate,
			// owner_id fylls i av databasen (default auth.uid())
		})
		.select(MAP_COLUMNS)
		.single();

	if (error) throw error;
	const map = data as MapRow;

	const { error: terrainError } = await supabase
		.from('map_terrain')
		.insert({ map_id: map.id, terrain: input.terrain });

	if (terrainError) {
		// Ta bort kartan igen, så att det inte ligger en karta utan terräng i listan
		await supabase.from('maps').delete().eq('id', map.id);
		throw terrainError;
	}

	return toMap(map);
}

/** Ändrar namn, beskrivning och synlighet på en karta. RLS gör att bara kartans ägare kan göra det. */
export async function updateMapInfo(
	mapId: string,
	changes: { name: string; description: string; isPrivate: boolean },
): Promise<OMap> {
	const { data, error } = await supabase
		.from('maps')
		.update({ name: changes.name, description: changes.description, isPrivate: changes.isPrivate })
		.eq('id', mapId)
		.select(MAP_COLUMNS)
		.maybeSingle();

	if (error) throw error;
	// Ingen rad tillbaka betyder att RLS stoppade ändringen (eller att kartan inte finns)
	if (!data) throw new Error('Du har inte behörighet att ändra den här kartan');
	return toMap(data as MapRow);
}

/** Tar bort en karta. Terrängen och alla lopp försvinner via "on delete cascade". */
export async function deleteMap(mapId: string): Promise<void> {
	const { data, error } = await supabase.from('maps').delete().eq('id', mapId).select('id');
	if (error) throw error;
	// RLS ger inget fel när en borttagning nekas – den tar bara bort noll rader
	if (!data || data.length === 0) throw new Error('Du har inte behörighet att ta bort den här kartan');
}

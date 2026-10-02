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
};

// Kolumnerna i `maps`. Skrivs ut i stället för '*' så att det syns exakt vad som hämtas.
const MAP_COLUMNS = 'id, owner_id, name, description, difficulty, controls, distance, center_lat, center_lng';

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
		.eq('runs.user_id', userId);

	if (error) throw error;

	return data.map((row) => ({
		...toMap(row as MapRow),
		state: getMapState(row.runs ?? []),
	}));
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

/** Kartan och dess terräng i ett och samma anrop – för kartskärmen. */
export async function fetchMapWithTerrain(mapId: string): Promise<MapWithTerrain | null> {
	const { data, error } = await supabase
		.from('maps')
		.select(`${MAP_COLUMNS}, map_terrain(terrain)`)
		.eq('id', mapId)
		.maybeSingle();

	if (error) throw error;
	if (!data) return null;

	// map_terrain är en en-till-en-koppling, så databasen svarar med ett objekt. Utan genererade
	// typer tror TypeScript att det är en lista, så vi hanterar båda fallen.
	const relation: unknown = data.map_terrain;
	const terrainRow = (Array.isArray(relation) ? relation[0] : relation) as { terrain: Terrain } | null | undefined;
	if (!terrainRow) throw new Error(`Kartan ${mapId} saknar terräng`);

	return { ...toMap(data as MapRow), terrain: terrainRow.terrain };
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

/** Tar bort en karta. Terrängen och alla lopp försvinner via "on delete cascade". */
export async function deleteMap(mapId: string): Promise<void> {
	const { error } = await supabase.from('maps').delete().eq('id', mapId);
	if (error) throw error;
}

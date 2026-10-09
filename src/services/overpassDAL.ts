import type { BoundingBox, Coordinate, Terrain, TerrainFeature, TerrainKind } from '@/types';
import { distanceInMeters } from '@/utilities/geo';

/**
 * Hämtar terräng från OpenStreetMap (via Overpass) för ett område och gör om den
 * till appens format. Samma logik som scripts/getMap.js, men för appen.
 */

// Flera servrar kör samma Overpass-tjänst. Om en är nere eller överbelastad provas nästa.
const OVERPASS_URLS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.private.coffee/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// Hur länge vi väntar på en server innan vi ger upp och provar nästa
const REQUEST_TIMEOUT_MS = 30_000;

/** Största tillåtna sida på området. Större områden blir långsamma och kan ge timeout. */
export const MAX_AREA_SIDE_M = 3000;

// Ytor ritas först och linjer sist, så att stigar hamnar ovanpå skogen.
const DRAW_ORDER: TerrainKind[] = ['open', 'forest', 'marsh', 'water', 'building', 'stream', 'road', 'path'];

const PATH_HIGHWAYS = new Set(['path', 'footway', 'track', 'bridleway', 'cycleway', 'steps']);
const SKIPPED_HIGHWAYS = new Set(['proposed', 'construction', 'platform', 'corridor', 'elevator']);

// ─── Overpass-svarets format ──────────────────────────────────────────────

type OsmPoint = { lat: number; lon: number };
type OsmTags = Record<string, string>;

type OsmWay = { type: 'way'; tags?: OsmTags; geometry?: (OsmPoint | null)[] };
type OsmRelation = {
	type: 'relation';
	tags?: OsmTags;
	members?: { type: string; role: string; geometry?: (OsmPoint | null)[] }[];
};
type OsmElement = OsmWay | OsmRelation | { type: 'node'; tags?: OsmTags };

type OverpassResponse = { elements: OsmElement[]; remark?: string };

type FeatureType = Pick<TerrainFeature, 'kind' | 'shape'>;

// ─── Publikt ──────────────────────────────────────────────────────────────

/** Områdets bredd och höjd i meter. */
export function bboxSizeInMeters({ south, west, north, east }: BoundingBox) {
	const midLat = (south + north) / 2;
	return {
		width: distanceInMeters({ latitude: midLat, longitude: west }, { latitude: midLat, longitude: east }),
		height: distanceInMeters({ latitude: south, longitude: west }, { latitude: north, longitude: west }),
	};
}

/** Hämtar och gör om terrängen för ett område. Kastar ett fel med ett läsbart meddelande. */
export async function fetchTerrainForArea(bbox: BoundingBox): Promise<Terrain> {
	const { width, height } = bboxSizeInMeters(bbox);
	if (width > MAX_AREA_SIDE_M || height > MAX_AREA_SIDE_M) {
		throw new Error(`Området är för stort. Zooma in så att det är max ${MAX_AREA_SIDE_M / 1000} km åt varje håll.`);
	}

	const data = await fetchOverpass(buildQuery(bbox));
	return convert(data, bbox);
}

// ─── Hämtning ─────────────────────────────────────────────────────────────

function buildQuery({ south, west, north, east }: BoundingBox): string {
	const landuse = 'forest|meadow|grass|reservoir';
	const natural = 'wood|scrub|water|wetland|grassland|heath';

	return `
		[out:json][timeout:60][bbox:${south},${west},${north},${east}];
		(
			way["highway"];
			way["waterway"];
			way["building"];
			way["landuse"~"^(${landuse})$"];
			way["natural"~"^(${natural})$"];
			relation["type"="multipolygon"]["landuse"~"^(${landuse})$"];
			relation["type"="multipolygon"]["natural"~"^(${natural})$"];
		);
		out geom;
	`;
}

/** Provar servrarna i tur och ordning och returnerar första lyckade svaret. */
async function fetchOverpass(query: string): Promise<OverpassResponse> {
	let lastError = new Error('Kartservern är överbelastad just nu. Försök igen om en stund.');

	for (const url of OVERPASS_URLS) {
		try {
			return await fetchFromServer(url, query);
		} catch (error) {
			console.warn(`Overpass: ${url} misslyckades – ${(error as Error).message}`);
			lastError = error as Error;
		}
	}

	// Alla servrar misslyckades
	throw lastError;
}

async function fetchFromServer(url: string, query: string): Promise<OverpassResponse> {
	// Avbryt anropet om servern inte svarar inom rimlig tid, så att nästa server hinner provas
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
				// Overpass svarar 406 på anrop utan en User-Agent som säger vem som frågar
				'User-Agent': 'OrienteringsOrangutang/1.0 (skolprojekt)',
			},
			body: `data=${encodeURIComponent(query)}`,
			signal: controller.signal,
		});
	} catch {
		throw new Error('Kunde inte nå kartservern. Kontrollera internetanslutningen.');
	} finally {
		clearTimeout(timeout);
	}

	if (response.status === 429 || response.status >= 500) {
		throw new Error('Kartservern är överbelastad just nu. Försök igen om en stund.');
	}
	if (!response.ok) {
		throw new Error(`Kartservern svarade med fel ${response.status}.`);
	}

	const data: OverpassResponse = await response.json();
	// Overpass kan svara 200 men ändå ha avbrutit frågan – då är datan ofullständig
	if (data.remark) {
		throw new Error('Kartservern hann inte hämta hela området. Prova ett mindre område.');
	}
	return data;
}

// ─── Omvandling ───────────────────────────────────────────────────────────

/** Bestämmer vad ett OSM-element är utifrån dess taggar. */
function classify(tags: OsmTags = {}): FeatureType | null {
	if (tags.building) return { kind: 'building', shape: 'polygon' };
	if (tags.natural === 'water' || tags.landuse === 'reservoir') return { kind: 'water', shape: 'polygon' };
	if (tags.natural === 'wetland') return { kind: 'marsh', shape: 'polygon' };
	if (tags.landuse === 'forest' || tags.natural === 'wood' || tags.natural === 'scrub') {
		return { kind: 'forest', shape: 'polygon' };
	}
	if (['meadow', 'grass'].includes(tags.landuse) || ['grassland', 'heath'].includes(tags.natural)) {
		return { kind: 'open', shape: 'polygon' };
	}
	if (tags.waterway) return { kind: 'stream', shape: 'line' };
	if (tags.highway && !SKIPPED_HIGHWAYS.has(tags.highway)) {
		return { kind: PATH_HIGHWAYS.has(tags.highway) ? 'path' : 'road', shape: 'line' };
	}
	return null;
}

// 6 decimaler ≈ 10 cm noggrannhet, vilket räcker gott och gör datan mindre.
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Overpass {lat, lon} → react-native-maps {latitude, longitude} */
const toCoordinates = (points: OsmPoint[]): Coordinate[] =>
	points.map((p) => ({ latitude: round(p.lat), longitude: round(p.lon) }));

const pointKey = (p: OsmPoint) => `${p.lat},${p.lon}`;
const isClosed = (points: OsmPoint[]) => points.length > 3 && pointKey(points[0]) === pointKey(points[points.length - 1]);
const withoutGaps = (points: (OsmPoint | null)[] = []) => points.filter((p): p is OsmPoint => p !== null);

/** En multipolygon består ofta av flera way-bitar. Den här funktionen fogar ihop dem till slutna ringar. */
function joinRings(segments: OsmPoint[][]): OsmPoint[][] {
	const remaining = segments.filter((s) => s.length > 1).map((s) => [...s]);
	const rings: OsmPoint[][] = [];

	while (remaining.length > 0) {
		const ring = remaining.shift()!;

		while (!isClosed(ring)) {
			const end = pointKey(ring[ring.length - 1]);
			const index = remaining.findIndex((s) => pointKey(s[0]) === end || pointKey(s[s.length - 1]) === end);
			if (index === -1) break; // ringen går inte att sluta, hoppa över den

			const next = remaining.splice(index, 1)[0];
			if (pointKey(next[0]) !== end) next.reverse();
			ring.push(...next.slice(1));
		}

		if (isClosed(ring)) rings.push(ring);
	}
	return rings;
}

/** Ray casting: ligger punkten innanför ringen? */
function isInside(point: OsmPoint, ring: OsmPoint[]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const a = ring[i];
		const b = ring[j];
		const crosses =
			a.lat > point.lat !== b.lat > point.lat &&
			point.lon < ((b.lon - a.lon) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lon;
		if (crosses) inside = !inside;
	}
	return inside;
}

function convertWay(element: OsmWay, type: FeatureType): TerrainFeature[] {
	const points = withoutGaps(element.geometry);
	if (type.shape === 'polygon') {
		if (!isClosed(points)) return [];
		return [{ ...type, coordinates: toCoordinates(points), holes: [] }];
	}
	if (points.length < 2) return [];
	return [{ ...type, coordinates: toCoordinates(points) }];
}

function convertRelation(element: OsmRelation, type: FeatureType): TerrainFeature[] {
	const members = (element.members ?? []).filter((m) => m.type === 'way' && m.geometry);
	const segmentsWithRole = (role: string) =>
		members.filter((m) => m.role === role).map((m) => withoutGaps(m.geometry));

	const outers = joinRings(segmentsWithRole('outer'));
	const inners = joinRings(segmentsWithRole('inner'));

	// Varje hål (t.ex. en glänta i skogen) tillhör den yttre ring som omsluter det.
	const holesByOuter: Coordinate[][][] = outers.map(() => []);
	for (const inner of inners) {
		const owner = outers.findIndex((outer) => isInside(inner[0], outer));
		holesByOuter[owner === -1 ? 0 : owner]?.push(toCoordinates(inner));
	}

	return outers.map((outer, i) => ({
		...type,
		coordinates: toCoordinates(outer),
		holes: holesByOuter[i],
	}));
}

function convert(data: OverpassResponse, bbox: BoundingBox): Terrain {
	const features: TerrainFeature[] = [];

	for (const element of data.elements) {
		const type = classify(element.tags);
		if (!type) continue;

		if (element.type === 'way') features.push(...convertWay(element, type));
		if (element.type === 'relation') features.push(...convertRelation(element, type));
	}

	features.sort((a, b) => DRAW_ORDER.indexOf(a.kind) - DRAW_ORDER.indexOf(b.kind));

	return {
		bbox,
		attribution: '© OpenStreetMap contributors',
		fetchedAt: new Date().toISOString(),
		features,
	};
}

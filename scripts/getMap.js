#!/usr/bin/env node

/**
 * Hämtar terrängdata från Overpass (OpenStreetMap) för ett område och sparar
 * den i appens format i src/data/terrain/<id>.json.
 *
 * Körs på datorn, inte i appen:
 *   npm run get-map -- <id> <syd> <väst> <nord> <öst>
 *   npm run get-map -- slottsskogen 57.680 11.935 57.690 11.950
 */

const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OUT_DIR = path.join(process.cwd(), 'src', 'data', 'terrain');

// Ytor ritas först och linjer sist, så att stigar hamnar ovanpå skogen.
const DRAW_ORDER = ['open', 'forest', 'marsh', 'water', 'building', 'stream', 'road', 'path'];

const PATH_HIGHWAYS = new Set(['path', 'footway', 'track', 'bridleway', 'cycleway', 'steps']);
const SKIPPED_HIGHWAYS = new Set(['proposed', 'construction', 'platform', 'corridor', 'elevator']);

function parseArgs() {
	const [id, ...rest] = process.argv.slice(2);
	const [south, west, north, east] = rest.map(Number);

	if (!id || rest.length !== 4 || [south, west, north, east].some(Number.isNaN)) {
		console.error('Användning: npm run get-map -- <id> <syd> <väst> <nord> <öst>');
		process.exit(1);
	}
	if (south >= north || west >= east) {
		console.error('Fel ordning: syd måste vara mindre än nord och väst mindre än öst.');
		process.exit(1);
	}
	return { id, bbox: { south, west, north, east } };
}

function buildQuery({ south, west, north, east }) {
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

async function fetchOverpass(query) {
	const response = await fetch(OVERPASS_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'User-Agent': 'OrienteringsOrangutang/1.0 (skolprojekt)',
		},
		body: `data=${encodeURIComponent(query)}`,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Overpass svarade ${response.status}: ${text.slice(0, 300)}`);
	}

	const data = await response.json();
	// Overpass kan svara 200 men ändå ha avbrutit frågan (t.ex. timeout).
	if (data.remark) {
		console.warn(`Varning från Overpass: ${data.remark}`);
	}
	return data;
}

/** Bestämmer vad ett OSM-element är utifrån dess taggar. */
function classify(tags = {}) {
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

// 6 decimaler ≈ 10 cm noggrannhet, vilket räcker gott och gör filen mindre.
const round = (n) => Math.round(n * 1e6) / 1e6;

/** Overpass {lat, lon} → react-native-maps {latitude, longitude} */
const toCoordinates = (points) => points.map((p) => ({ latitude: round(p.lat), longitude: round(p.lon) }));

const pointKey = (p) => `${p.lat},${p.lon}`;
const isClosed = (points) => points.length > 3 && pointKey(points[0]) === pointKey(points[points.length - 1]);

/**
 * En multipolygon-relation består ofta av flera way-bitar som tillsammans bildar
 * en ring. Den här funktionen fogar ihop bitarna till slutna ringar.
 */
function joinRings(segments) {
	const remaining = segments.filter((s) => s.length > 1).map((s) => [...s]);
	const rings = [];

	while (remaining.length > 0) {
		const ring = remaining.shift();

		while (!isClosed(ring)) {
			const end = pointKey(ring[ring.length - 1]);
			const index = remaining.findIndex(
				(s) => pointKey(s[0]) === end || pointKey(s[s.length - 1]) === end,
			);
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
function isInside(point, ring) {
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

function convertWay(element, type) {
	const points = (element.geometry ?? []).filter(Boolean);
	if (type.shape === 'polygon') {
		if (!isClosed(points)) return [];
		return [{ ...type, coordinates: toCoordinates(points), holes: [] }];
	}
	if (points.length < 2) return [];
	return [{ ...type, coordinates: toCoordinates(points) }];
}

function convertRelation(element, type) {
	const members = (element.members ?? []).filter((m) => m.type === 'way' && m.geometry);
	const segmentsWithRole = (role) =>
		members.filter((m) => m.role === role).map((m) => m.geometry.filter(Boolean));

	const outers = joinRings(segmentsWithRole('outer'));
	const inners = joinRings(segmentsWithRole('inner'));

	// Varje hål (t.ex. en glänta i skogen) tillhör den yttre ring som omsluter det.
	const holesByOuter = outers.map(() => []);
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

function convert(data, bbox) {
	const features = [];

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

async function main() {
	const { id, bbox } = parseArgs();

	console.log(`Hämtar data för "${id}"...`);
	const data = await fetchOverpass(buildQuery(bbox));
	console.log(`Fick ${data.elements.length} element från Overpass.`);

	const terrain = convert(data, bbox);

	fs.mkdirSync(OUT_DIR, { recursive: true });
	const outFile = path.join(OUT_DIR, `${id}.json`);
	fs.writeFileSync(outFile, JSON.stringify(terrain));

	const counts = {};
	for (const f of terrain.features) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
	console.table(counts);

	const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(0);
	console.log(`Sparade ${terrain.features.length} objekt (${sizeKb} kB) i ${path.relative(process.cwd(), outFile)}`);
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});

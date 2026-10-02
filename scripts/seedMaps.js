#!/usr/bin/env node

/**
 * Lägger in de lokala kartorna (src/data/terrain/*.json) i Supabase: en rad i `maps`
 * och terrängen i `map_terrain`. Kartor som redan finns (samma namn och ägare) hoppas över.
 *
 * Körs på datorn, inte i appen:
 *   npm run seed-maps -- <ägarens-profil-id>
 *
 * Kräver SUPABASE_SECRET_KEY i .env (utan EXPO_PUBLIC_ – den får aldrig hamna i appen).
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const TERRAIN_DIR = path.join(process.cwd(), 'src', 'data', 'terrain');

// Samma kartor som i src/data/maps.ts
const MAPS = [
	{
		file: 'campus.json',
		name: 'Campus',
		description: 'Kort bana i campusmiljö',
		difficulty: 'easy',
		controls: [{ id: 'c1', latitude: 63.821577213387, longitude: 20.310382985291987 }],
	},
	{
		file: 'berghem.json',
		name: 'berghem',
		description: 'Kort bana i berghem',
		difficulty: 'easy',
		controls: [],
	},
];

// ─── Samma uträkningar som i src/utilities/geo.ts ─────────────────────────

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg) => (deg * Math.PI) / 180;

function distanceInMeters(a, b) {
	const dLat = toRad(b.latitude - a.latitude);
	const dLng = toRad(b.longitude - a.longitude);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function courseLengthInMeters(controls) {
	if (controls.length < 2) return null;
	let total = 0;
	for (let i = 1; i < controls.length; i++) total += distanceInMeters(controls[i - 1], controls[i]);
	return total;
}

// ─── Skriptet ─────────────────────────────────────────────────────────────

function setup() {
	try {
		process.loadEnvFile('.env');
	} catch {
		console.error('Hittar ingen .env i projektets rot.');
		process.exit(1);
	}

	const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
	const secretKey = process.env.SUPABASE_SECRET_KEY;
	const ownerId = process.argv[2];

	if (!url || !secretKey) {
		console.error('EXPO_PUBLIC_SUPABASE_URL och SUPABASE_SECRET_KEY måste finnas i .env.');
		process.exit(1);
	}
	if (!ownerId) {
		console.error('Användning: npm run seed-maps -- <ägarens-profil-id>');
		console.error('Profil-id hittar du i Supabase under Table Editor → profiles.');
		process.exit(1);
	}

	const supabase = createClient(url, secretKey, { auth: { persistSession: false } });
	return { supabase, ownerId };
}

async function seedMap(supabase, ownerId, map) {
	const { data: existing, error: findError } = await supabase
		.from('maps')
		.select('id')
		.eq('owner_id', ownerId)
		.eq('name', map.name)
		.maybeSingle();
	if (findError) throw findError;
	if (existing) {
		console.log(`– ${map.name}: finns redan (${existing.id}), hoppar över`);
		return;
	}

	const terrain = JSON.parse(fs.readFileSync(path.join(TERRAIN_DIR, map.file), 'utf8'));
	const { south, west, north, east } = terrain.bbox;

	const { data: created, error: insertError } = await supabase
		.from('maps')
		.insert({
			owner_id: ownerId, // secret-nyckeln har ingen auth.uid(), så ägaren måste anges
			name: map.name,
			description: map.description,
			difficulty: map.difficulty,
			controls: map.controls,
			distance: courseLengthInMeters(map.controls),
			center_lat: (south + north) / 2,
			center_lng: (west + east) / 2,
		})
		.select('id')
		.single();
	if (insertError) throw insertError;

	const { error: terrainError } = await supabase
		.from('map_terrain')
		.insert({ map_id: created.id, terrain });
	if (terrainError) {
		await supabase.from('maps').delete().eq('id', created.id);
		throw terrainError;
	}

	console.log(`✓ ${map.name}: skapad (${created.id}), ${terrain.features.length} terrängobjekt`);
}

async function main() {
	const { supabase, ownerId } = setup();

	const { data: owner, error } = await supabase.from('profiles').select('id').eq('id', ownerId).maybeSingle();
	if (error) throw error;
	if (!owner) throw new Error(`Ingen profil med id ${ownerId}`);

	for (const map of MAPS) {
		await seedMap(supabase, ownerId, map);
	}
}

main().catch((error) => {
	console.error('Fel:', error.message ?? error);
	process.exit(1);
});

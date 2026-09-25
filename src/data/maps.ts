import type { Control, Coordinate, OMap, Terrain } from '@/types';
import berghemTerrain from './terrain/berghem.json';
import campusTerrain from './terrain/campus.json';

// Det man skriver för hand: bbox hämtas från terrängen, start/finish är valfria.
type MapInput = Omit<OMap, 'bbox' | 'start' | 'finish' | 'terrain'> & {
	terrain: Terrain;
	start?: Coordinate;
	finish?: Coordinate;
};

function centerOf(terrain: Terrain): Coordinate {
	const { south, west, north, east } = terrain.bbox;
	return { latitude: (south + north) / 2, longitude: (west + east) / 2 };
}

function defineMap(input: MapInput): OMap {
	const first: Control | undefined = input.controls[0];
	const last: Control | undefined = input.controls[input.controls.length - 1];

	return {
		...input,
		bbox: input.terrain.bbox,
		// Eget värde → första/sista kontrollen → mitten av kartan
		start: input.start ?? first ?? centerOf(input.terrain),
		finish: input.finish ?? last ?? centerOf(input.terrain),
	};
}

export const maps: OMap[] = [
	defineMap({
		id: 'campus',
		name: 'Campus',
		description: 'Kort bana i campusmiljö',
		difficulty: 'Easy',
		controls: [
			{ id: 'c1', latitude: 63.821577213387, longitude: 20.310382985291987 },
		], // TODO: lägg till kontroller på campus
		terrain: campusTerrain as Terrain,
	}),
		defineMap({
		id: 'berghem',
		name: 'berghem',
		description: 'Kort bana i berghem',
		difficulty: 'Easy',
		controls: [], 
		terrain: berghemTerrain as Terrain,
	}),
	// nästa karta...
];

export function getMapById(id: string): OMap | undefined {
	return maps.find((m) => m.id === id);
}

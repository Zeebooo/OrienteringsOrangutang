import type { OMap, Terrain } from '@/types';
import { bboxCenter, courseLengthInMeters } from '@/utilities/geo';
import berghemTerrain from './terrain/berghem.json';
import campusTerrain from './terrain/campus.json';

// Lokala kartor som ännu inte ligger i databasen har ingen skapare
const LOCAL_OWNER = 'local';

// Det man skriver för hand. Mittpunkt och längd räknas ut från terrängen och kontrollerna.
type MapInput = Omit<OMap, 'ownerId' | 'center' | 'distanceM' | 'terrain'> & {
	terrain: Terrain;
};

function defineMap(input: MapInput): OMap {
	return {
		...input,
		ownerId: LOCAL_OWNER,
		center: bboxCenter(input.terrain.bbox),
		distanceM: courseLengthInMeters(input.controls),
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

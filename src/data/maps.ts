import type { OMap, Terrain } from '@/types';
import slottsskogenTerrain from './terrain/slottsskogen.json';

export const maps: OMap[] = [
	{
		id: 'slottsskogen',
		name: 'Slottsskogen',
		description: 'Kort bana i parkmiljö',
		difficulty: 'Easy',
		bbox: { south: 57.680, west: 11.935, north: 57.690, east: 11.950 },
		start: { latitude: 57.6845, longitude: 11.9400 },
		finish: { latitude: 57.6850, longitude: 11.9410 },
		controls: [
			{ id: 'c1', latitude: 57.6860, longitude: 11.9420 },
			{ id: 'c2', latitude: 57.6875, longitude: 11.9445 },
		],
		terrain: slottsskogenTerrain as Terrain,
	},
	// nästa karta...
];

export function getMapById(id: string): OMap | undefined {
	return maps.find((m) => m.id === id);
}
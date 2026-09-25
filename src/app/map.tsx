import { bboxToRegion } from '@/utilities/bboxToRegion';
import { StyleSheet } from 'react-native';
import MapView, { Polygon, Polyline } from 'react-native-maps';

import { getMapById } from '@/data/maps';
import type { TerrainFeature } from '@/types';


function getTerrainColor(kind: string): string {
	switch (kind) {
		case 'open':
			return 'rgba(255, 255, 0, 0.5)'; // gul
		case 'forest':
			return 'rgba(0, 128, 0, 0.5)'; // grön
		case 'marsh':
			return 'rgba(0, 255, 255, 0.5)'; // cyan
		case 'water':
			return 'rgba(0, 0, 255, 0.5)'; // blå
		case 'building':
			return 'rgba(128, 128, 128, 0.5)'; // grå
		case 'stream':
			return 'rgba(0, 191, 255, 0.5)'; // djupblå
		case 'road':
			return 'rgba(255, 165, 0, 0.5)'; // orange
		case 'path':
			return 'rgba(139, 69, 19, 0.5)'; // brun
		default:
			return 'rgba(0, 0, 0, 0.5)'; // svart som fallback
	}
}

function renderTerrainFeature(feature: TerrainFeature, index: number) {
	const { kind, shape, coordinates } = feature;

	if (shape === 'line') {
		return (
			<Polyline
				key={index}
				coordinates={coordinates}
				strokeColor={getTerrainColor(kind)}
				strokeWidth={3}
			/>
		);
	} else if (shape === 'polygon') {
		return (
			<Polygon
				key={index}
				coordinates={coordinates}
				fillColor={getTerrainColor(kind)}
				strokeColor={getTerrainColor(kind)}
				strokeWidth={1}
				holes={feature.holes}
			/>
		);
	}

	return null;
}


export default function MapTestScreen() {
	const map = getMapById('slottsskogen');

	if (!map || !map.terrain) {
		return null; // eller visa ett felmeddelande
	}

	return (
		<MapView style={styles.map} initialRegion={bboxToRegion(map.bbox)}>
			{map.terrain.features.map((feature, index) => renderTerrainFeature(feature, index))}
		</MapView>
	);
}

const styles = StyleSheet.create({
	map: {
		flex: 1,
	},
});

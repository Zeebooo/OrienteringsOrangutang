import { Fragment, memo } from 'react';
import { Polygon, Polyline } from 'react-native-maps';

import type { Terrain, TerrainFeature, TerrainKind } from '@/types';

const ROAD_OUTLINE_COLOR = '#000000';

// Record<TerrainKind, …> gör att TypeScript klagar om en terrängtyp saknar färg.
export const TERRAIN_COLORS: Record<TerrainKind, string> = {
	open: '#CDEBB0',
	forest: '#789c6f',
	marsh: 'rgba(0, 255, 255, 0.5)',
	water: '#0399D9',
	building: 'rgba(30, 30, 30, 0.8)',
	stream: '#8BE1F7',
	road: '#b5793f', // brun – måste vara ogenomskinlig, annars syns den svarta kanten igenom
	path: '#000000',
};

function TerrainShape({ feature }: { feature: TerrainFeature }) {
	const { kind, shape, coordinates } = feature;
	const color = TERRAIN_COLORS[kind];

	if (shape === 'polygon') {
		return <Polygon coordinates={coordinates} fillColor={color} strokeColor={color} strokeWidth={1} holes={feature.holes} />;
	}

	if (kind === 'path') {
		return <Polyline coordinates={coordinates} strokeColor={color} strokeWidth={1} lineDashPattern={[1, 2]} />;
	}

	if (kind === 'road') {
		// Svart kantlinje underst och en smalare brun linje ovanpå
		return (
			<Fragment>
				<Polyline coordinates={coordinates} strokeColor={ROAD_OUTLINE_COLOR} strokeWidth={5} />
				<Polyline coordinates={coordinates} strokeColor={color} strokeWidth={3} />
			</Fragment>
		);
	}

	return <Polyline coordinates={coordinates} strokeColor={color} strokeWidth={3} />;
}

type Props = {
	terrain: Terrain;
};

/**
 * Ritar all terräng. Läggs inuti en <MapView>:
 *   <MapView ...><TerrainLayer terrain={terrain} /></MapView>
 *
 * memo gör att de hundratals formerna inte ritas om när något annat på skärmen
 * ändras (t.ex. användarens position), bara när terrängen själv byts ut.
 */
export const TerrainLayer = memo(function TerrainLayer({ terrain }: Props) {
	return (
		<>
			{terrain.features.map((feature, index) => (
				<TerrainShape key={index} feature={feature} />
			))}
		</>
	);
});

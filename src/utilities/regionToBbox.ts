import type { Region } from 'react-native-maps';

import type { BoundingBox } from '@/types';

/** Det synliga området på kartan som bounding box (motsatsen till bboxToRegion). */
export function regionToBbox(region: Region): BoundingBox {
	return {
		south: region.latitude - region.latitudeDelta / 2,
		north: region.latitude + region.latitudeDelta / 2,
		west: region.longitude - region.longitudeDelta / 2,
		east: region.longitude + region.longitudeDelta / 2,
	};
}

export type ScreenRect = { x: number; y: number; width: number; height: number };

/**
 * Bounding box för en del av kartan, t.ex. en ram som ligger ovanpå den.
 * `rect` anges i pixlar från kartans övre vänstra hörn, `mapSize` är kartans storlek i pixlar.
 *
 * Räknar linjärt mellan pixlar och grader. Det är en förenkling (kartor är egentligen
 * Mercator-projicerade), men för områden på några km blir felet bara någon meter.
 */
export function rectToBbox(region: Region, mapSize: { width: number; height: number }, rect: ScreenRect): BoundingBox {
	const { north, west } = regionToBbox(region);
	const latPerPixel = region.latitudeDelta / mapSize.height;
	const lngPerPixel = region.longitudeDelta / mapSize.width;

	return {
		north: north - rect.y * latPerPixel,
		south: north - (rect.y + rect.height) * latPerPixel,
		west: west + rect.x * lngPerPixel,
		east: west + (rect.x + rect.width) * lngPerPixel,
	};
}

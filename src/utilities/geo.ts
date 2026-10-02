import type { Coordinate } from '@/types';

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Fågelvägen i meter mellan två punkter (haversine-formeln). */
export function distanceInMeters(a: Coordinate, b: Coordinate): number {
	const dLat = toRad(b.latitude - a.latitude);
	const dLng = toRad(b.longitude - a.longitude);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Sammanlagd längd i meter längs punkterna i ordning (t.ex. kontroll 1 → 2 → 3). */
export function pathLengthInMeters(points: Coordinate[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		total += distanceInMeters(points[i - 1], points[i]);
	}
	return total;
}

import type { BoundingBox, Control, Coordinate } from '@/types';

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

/** Banans längd i meter, eller null om den har färre än två kontroller. */
export function courseLengthInMeters(controls: Control[]): number | null {
	return controls.length >= 2 ? pathLengthInMeters(controls) : null;
}

/** Mittpunkten i en bounding box. */
export function bboxCenter({ south, west, north, east }: BoundingBox): Coordinate {
	return { latitude: (south + north) / 2, longitude: (west + east) / 2 };
}

/** Om punkten ligger inom bounding boxen (kanten räknas som innanför). */
export function isInsideBbox(point: Coordinate, { south, west, north, east }: BoundingBox): boolean {
	return point.latitude >= south && point.latitude <= north && point.longitude >= west && point.longitude <= east;
}

/** Närmaste punkt inom bounding boxen. En punkt utanför flyttas in till kanten. */
export function clampToBbox(point: Coordinate, { south, west, north, east }: BoundingBox): Coordinate {
	return {
		latitude: Math.min(north, Math.max(south, point.latitude)),
		longitude: Math.min(east, Math.max(west, point.longitude)),
	};
}

/** Bounding boxens fyra hörn i ordning, t.ex. för att rita dess kant. */
export function bboxCorners({ south, west, north, east }: BoundingBox): Coordinate[] {
	return [
		{ latitude: north, longitude: west },
		{ latitude: north, longitude: east },
		{ latitude: south, longitude: east },
		{ latitude: south, longitude: west },
	];
}

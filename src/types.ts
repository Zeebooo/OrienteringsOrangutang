export type Coordinate = {
	latitude: number;
	longitude: number;
};

export type Control = Coordinate & {
	id: string;
	description?: string;
};

export type BoundingBox = {
	south: number;
	west: number;
	north: number;
	east: number;
};

export type TerrainKind = 'open' | 'forest' | 'marsh' | 'water' | 'building' | 'stream' | 'road' | 'path';

/** Genereras av scripts/getMap.js – redan sorterad i ritordning. */
export type TerrainFeature = {
	kind: TerrainKind;
	shape: 'line' | 'polygon';
	coordinates: Coordinate[];
	holes?: Coordinate[][];
};

export type Terrain = {
	bbox: BoundingBox;
	attribution: string;
	fetchedAt: string;
	features: TerrainFeature[];
};

export type OMap = {
	id: string;
	name: string;
	description: string;
	difficulty: 'Easy' | 'Medium' | 'Hard';
	bbox: BoundingBox;
	start: Coordinate;
	finish: Coordinate;
	controls: Control[];
	terrain?: Terrain;
};
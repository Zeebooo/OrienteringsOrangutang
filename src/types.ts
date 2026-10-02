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

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

/** En karta som appen använder den. Terrängen följer bara med när kartan öppnas. */
export type OMap = {
	id: string;
	ownerId: string;
	name: string;
	description: string;
	difficulty: Difficulty;
	controls: Control[];
	distanceM: number | null; // banans längd i meter, null om färre än 2 kontroller
	center: Coordinate; // för sortering efter avstånd
	terrain?: Terrain; // finns bara när kartan hämtats med terräng
};
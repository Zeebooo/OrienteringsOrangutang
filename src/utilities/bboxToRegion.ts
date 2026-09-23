import type { Region } from 'react-native-maps';

import type { BoundingBox } from '@/types';

export function bboxToRegion(bbox: BoundingBox): Region {
	return {
		latitude: (bbox.south + bbox.north) / 2, // mitten i nord-sydlig led
		longitude: (bbox.west + bbox.east) / 2, // mitten i öst-västlig led
		latitudeDelta: bbox.north - bbox.south, // hur högt område som syns
		longitudeDelta: bbox.east - bbox.west, // hur brett område som syns
	};
}
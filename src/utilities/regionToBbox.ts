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

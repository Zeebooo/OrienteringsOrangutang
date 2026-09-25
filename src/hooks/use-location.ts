import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { Coordinate } from '@/types';

/**
 * Ber om tillåtelse att använda platsen och följer sedan användarens position.
 * `location` är null tills första positionen har kommit in.
 */
export function useLocation() {
	const [location, setLocation] = useState<Coordinate | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	useEffect(() => {
		let subscription: Location.LocationSubscription | undefined;
		let cancelled = false;

		async function start() {
			const { status } = await Location.requestForegroundPermissionsAsync();
			if (cancelled) return;
			if (status !== 'granted') {
				setErrorMsg('Permission to access location was denied');
				return;
			}

			// Uppdateras löpande när användaren rör sig (var 2:e meter)
			subscription = await Location.watchPositionAsync(
				{ accuracy: Location.Accuracy.High, distanceInterval: 2 },
				(position) => {
					setLocation({
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
					});
				},
			);

			// Skärmen stängdes medan vi väntade på GPS:en – stäng direkt
			if (cancelled) subscription.remove();
		}

		start();

		// Slutar följa positionen när skärmen lämnas, annars drar GPS:en batteri
		return () => {
			cancelled = true;
			subscription?.remove();
		};
	}, []);

	return { location, errorMsg };
}

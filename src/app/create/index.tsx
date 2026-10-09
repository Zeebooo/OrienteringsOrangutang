import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';

import { useCreateMap } from '@/context/CreateMapContext';
import campusTerrain from '@/data/terrain/campus.json';
import { useLocation } from '@/hooks/use-location';
import { bboxSizeInMeters, fetchTerrainForArea, MAX_AREA_SIDE_M } from '@/services/overpassDAL';
import type { Terrain } from '@/types';
import { regionToBbox } from '@/utilities/regionToBbox';

// Hur stort område som visas när kartan flyttas till användarens position (≈ 1 km)
const START_DELTA = 0.01;

// Steg 1: användaren flyttar kartan, och det synliga området blir kartans bounding box
export default function SelectAreaScreen() {
	const router = useRouter();
	const { setTerrain } = useCreateMap();
	const { location } = useLocation();
	const mapRef = useRef<MapView>(null);

	const [region, setRegion] = useState<Region | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Flytta kartan till användaren en gång, när första positionen kommer in
	const hasCentered = useRef(false);
	useEffect(() => {
		if (!location || hasCentered.current) return;
		hasCentered.current = true;
		mapRef.current?.animateToRegion({ ...location, latitudeDelta: START_DELTA, longitudeDelta: START_DELTA });
	}, [location]);

	// Räknas om vid varje rendering – behöver inget eget state
	const bbox = region ? regionToBbox(region) : null;
	const size = bbox ? bboxSizeInMeters(bbox) : null;
	const tooBig = !size || size.width > MAX_AREA_SIDE_M || size.height > MAX_AREA_SIDE_M;

	async function handleNext() {
		if (!bbox) return;
		setLoading(true);
		setError(null);
		try {
			const terrain = await fetchTerrainForArea(bbox);
			setTerrain(terrain);
			router.push('/create/controls');
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}

	// Bara under utveckling: hoppa över Overpass och använd en sparad terräng
	function applyTestTerrain() {
		setTerrain(campusTerrain as Terrain);
		router.push('/create/controls');
	}

	return (
		<View style={styles.container}>
			{/* Kartan underst, fyller hela skärmen */}
			<MapView
				ref={mapRef}
				style={StyleSheet.absoluteFill}
				onRegionChangeComplete={setRegion}
				showsUserLocation
				rotateEnabled={false} // bounding boxen är alltid rak mot norr
				pitchEnabled={false}
			/>

			{/* Panelen ritas ovanpå kartan eftersom den står efter i JSX:en */}
			<View style={styles.bottomPanel}>
				<Text style={styles.text}>Flytta kartan till området du vill använda</Text>

				{size && (
					<Text style={styles.size}>
						{(size.width / 1000).toFixed(1).replace('.', ',')} × {(size.height / 1000).toFixed(1).replace('.', ',')} km
					</Text>
				)}
				{size && tooBig && (
					<Text style={styles.warning}>Zooma in – max {MAX_AREA_SIDE_M / 1000} km åt varje håll</Text>
				)}
				{error && <Text style={styles.warning}>{error}</Text>}

				{loading ? (
					<ActivityIndicator />
				) : (
					<Button title={error ? 'Försök igen' : 'Nästa'} onPress={handleNext} disabled={tooBig} />
				)}

				{/* __DEV__ är true under `npx expo start` och false i en riktig build */}
				{__DEV__ && !loading && <Button title="Använd testkarta (Campus)" onPress={applyTestTerrain} color="#888" />}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	bottomPanel: {
		position: 'absolute',
		left: 16,
		right: 16,
		bottom: 32,
		backgroundColor: 'white',
		borderRadius: 16,
		padding: 16,
		gap: 12,
		// skugga så att panelen syns mot kartan
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 6,
	},
	text: {
		fontSize: 16,
		textAlign: 'center',
	},
	size: {
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
	},
	warning: {
		fontSize: 14,
		color: '#c0392b',
		textAlign: 'center',
	},
});

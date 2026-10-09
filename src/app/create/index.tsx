import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import MapView, { type Region } from 'react-native-maps';

import { StepProgress } from '@/components/StepProgress';
import { Colors } from '@/constants/theme';
import { useCreateMap } from '@/context/CreateMapContext';
import campusTerrain from '@/data/terrain/campus.json';
import { useLocation } from '@/hooks/use-location';
import { bboxSizeInMeters, fetchTerrainForArea, MAX_AREA_SIDE_M } from '@/services/overpassDAL';
import type { Terrain } from '@/types';
import { rectToBbox, type ScreenRect } from '@/utilities/regionToBbox';

// Hur stort område som visas när kartan flyttas till användarens position (≈ 1 km)
const START_DELTA = 0.015;

// Utrymme högst upp för stegindikatorn, och marginal runt ramen
const TOP_SPACE = 64;
const FRAME_MARGIN = 28;
const DIM_COLOR = 'rgba(0, 0, 0, 0.25)';

// Steg 1: ramen ligger still på skärmen och användaren flyttar kartan under den.
// Det som syns innanför ramen blir kartans bounding box.
export default function SelectAreaScreen() {
	const router = useRouter();
	const { setTerrain } = useCreateMap();
	const { location } = useLocation();
	const mapRef = useRef<MapView>(null);

	const [region, setRegion] = useState<Region | null>(null);
	const [mapSize, setMapSize] = useState<{ width: number; height: number } | null>(null);
	const [sheetHeight, setSheetHeight] = useState(0);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Flytta kartan till användaren en gång, när första positionen kommer in
	const hasCentered = useRef(false);
	useEffect(() => {
		if (!location || hasCentered.current) return;
		hasCentered.current = true;
		mapRef.current?.animateToRegion({ ...location, latitudeDelta: START_DELTA, longitudeDelta: START_DELTA });
	}, [location]);

	// Ramens position i pixlar räknas ut från kartans och panelens storlek
	const frame = mapSize ? getFrameRect(mapSize, sheetHeight) : null;
	const bbox = region && mapSize && frame ? rectToBbox(region, mapSize, frame) : null;
	const size = bbox ? bboxSizeInMeters(bbox) : null;
	const tooBig = !size || size.width > MAX_AREA_SIDE_M || size.height > MAX_AREA_SIDE_M;

	async function handleUseArea() {
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

	function handleMapLayout(e: LayoutChangeEvent) {
		const { width, height } = e.nativeEvent.layout;
		setMapSize({ width, height });
	}

	return (
		<View style={styles.container}>
			<MapView
				ref={mapRef}
				style={StyleSheet.absoluteFill}
				onLayout={handleMapLayout}
				onRegionChangeComplete={setRegion}
				showsUserLocation
				rotateEnabled={false} // bounding boxen är alltid rak mot norr
				pitchEnabled={false}
				userInterfaceStyle="light"
			/>

			{/* Ramen och den dämpade kartan runt den. pointerEvents="none" släpper igenom tryck till kartan. */}
			{frame && <FrameOverlay frame={frame} />}

			<StepProgress current={1} total={3} style={styles.steps} />

			{/* Panelen längst ner. Dess höjd används för att placera ramen ovanför den. */}
			<View style={styles.sheet} onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}>
				<Text style={styles.text}>Flytta och zooma kartan{'\n'}för att välja område</Text>
				<MaterialCommunityIcons name="selection" size={36} color={Colors.light.textMain} style={styles.icon} />

				{size && (
					<Text style={[styles.size, tooBig && styles.warning]}>
						{formatKm(size.width)} × {formatKm(size.height)} km
						{tooBig && ` – zooma in, max ${MAX_AREA_SIDE_M / 1000} km`}
					</Text>
				)}
				{error && <Text style={styles.warning}>{error}</Text>}

				<TouchableOpacity
					style={[styles.button, (tooBig || loading) && styles.buttonDisabled]}
					onPress={handleUseArea}
					disabled={tooBig || loading}
				>
					{loading ? (
						<ActivityIndicator color={Colors.light.background} />
					) : (
						<Text style={styles.buttonText}>{error ? 'Försök igen' : 'Använd område'}</Text>
					)}
				</TouchableOpacity>

				{/* __DEV__ är true under `npx expo start` och false i en riktig build */}
				{__DEV__ && !loading && (
					<TouchableOpacity onPress={applyTestTerrain}>
						<Text style={styles.devLink}>Använd testkarta (Campus)</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
}

// ─── Ramen ────────────────────────────────────────────────────────────────

/** Ramen centreras i utrymmet mellan stegindikatorn och panelen. */
function getFrameRect(mapSize: { width: number; height: number }, sheetHeight: number): ScreenRect | null {
	const width = mapSize.width - FRAME_MARGIN * 2;
	const available = mapSize.height - sheetHeight - TOP_SPACE;
	const height = Math.min(width * 1.05, available - FRAME_MARGIN);
	if (width <= 0 || height <= 0) return null;

	return {
		x: FRAME_MARGIN,
		y: TOP_SPACE + (available - height) / 2,
		width,
		height,
	};
}

function FrameOverlay({ frame }: { frame: ScreenRect }) {
	const bottom = frame.y + frame.height;
	const right = frame.x + frame.width;

	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="none">
			{/* Fyra dämpade ytor runt ramen */}
			<View style={[styles.dim, { top: 0, left: 0, right: 0, height: frame.y }]} />
			<View style={[styles.dim, { top: bottom, left: 0, right: 0, bottom: 0 }]} />
			<View style={[styles.dim, { top: frame.y, left: 0, width: frame.x, height: frame.height }]} />
			<View style={[styles.dim, { top: frame.y, left: right, right: 0, height: frame.height }]} />

			{/* Själva ramen */}
			<View style={[styles.frame, { top: frame.y, left: frame.x, width: frame.width, height: frame.height }]} />
		</View>
	);
}

const formatKm = (meters: number) => (meters / 1000).toFixed(1).replace('.', ',');

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	steps: {
		position: 'absolute',
		top: 16,
		left: 48,
		right: 48,
	},
	dim: {
		position: 'absolute',
		backgroundColor: DIM_COLOR,
	},
	frame: {
		position: 'absolute',
		borderWidth: 2,
		borderColor: 'black',
	},
	sheet: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: Colors.light.beigeBg,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		paddingHorizontal: 20,
		paddingTop: 24,
		paddingBottom: 36,
		alignItems: 'center',
		gap: 10,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -2 },
		shadowOpacity: 0.1,
		shadowRadius: 10,
		elevation: 10,
	},
	text: {
		fontSize: 18,
		textAlign: 'center',
		color: Colors.light.textMain,
	},
	icon: {
		marginVertical: 4,
	},
	size: {
		fontSize: 14,
		fontWeight: '600',
		color: Colors.light.textMuted,
		textAlign: 'center',
	},
	warning: {
		color: Colors.light.danger,
		textAlign: 'center',
	},
	button: {
		alignSelf: 'stretch',
		backgroundColor: Colors.light.primary,
		borderRadius: 10,
		paddingVertical: 16,
		alignItems: 'center',
		marginTop: 4,
	},
	buttonDisabled: {
		backgroundColor: '#CCC',
	},
	buttonText: {
		color: Colors.light.background,
		fontSize: 18,
		fontWeight: '600',
	},
	devLink: {
		color: Colors.light.textMuted,
		textDecorationLine: 'underline',
		paddingVertical: 4,
	},
});

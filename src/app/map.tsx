import { useLocation } from '@/hooks/use-location';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TerrainLayer } from '@/components/TerrainLayer';
import { Colors } from '@/constants/theme';
import { useProgress } from '@/context/ProgressContext';
import { fetchMapWithTerrain, type MapWithTerrain } from '@/services/mapsDAL';
import type { Difficulty } from '@/types';
import { bboxToRegion } from '@/utilities/bboxToRegion';

// Begränsar hur långt in/ut man kan zooma.
// iOS (Apple Maps): kamerans avstånd till marken i meter – mindre = mer inzoomat.
const CAMERA_ZOOM_RANGE = { minCenterCoordinateDistance: 1000, maxCenterCoordinateDistance: 6000 };

// Med typen Difficulty klagar TypeScript om ett case stavas fel eller saknas
function getDifficultyInfo(difficulty: Difficulty) {
	switch (difficulty) {
		case 'easy': return 'Lätt';
		case 'medium': return 'Medelsvår';
		case 'hard': return 'Svår';
	}
}

export default function MapDetailScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams();

	// 1. VIKTIGT: Vi flyttar upp useProgress() hit till toppen!
	const { startedMaps, completedMaps, startMap, completeMap } = useProgress();
	// Hooks måste anropas före alla tidiga return
	const { location } = useLocation();

	const mapId = Array.isArray(id) ? id[0] : id;

	// Kartan hämtas från databasen – null tills svaret har kommit
	const [map, setMap] = useState<MapWithTerrain | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!mapId) return;
		fetchMapWithTerrain(mapId)
			.then((result) => {
				if (result) setMap(result);
				else setError('Kartan finns inte');
			})
			.catch((e: Error) => setError(e.message));
	}, [mapId]);

	if (!mapId || error) {
		return (
			<View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
				<Text style={{ color: Colors.light.text }}>{error ?? 'Ingen karta vald'}</Text>
			</View>
		);
	}

	if (!map) {
		return (
			<View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
				<Text style={{ color: Colors.light.text }}>Kartan laddas...</Text>
			</View>
		);
	}

	if (!location) {
		return (
			<View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
				<Text style={{ color: Colors.light.text }}>Hämtar din position...</Text>
			</View>
		);
	}

	// 2. Vi räknar ut status här istället för nere vid knappen
	const isCompleted = completedMaps.includes(map.id);
	const isStarted = startedMaps.includes(map.id);

	const handlePress = () => {
		if (isCompleted) {
			router.back();
		} else if (isStarted) {
			completeMap(map.id);
			router.back();
		} else {
			startMap(map.id);
		}
	};

	let buttonText = 'Starta bana';
	if (isCompleted) buttonText = 'Se resultat';
	if (isStarted && !isCompleted) buttonText = 'Avsluta orientering (Test)';

	return (
		<View style={styles.container}>

			<MapView
				style={StyleSheet.absoluteFill}
				initialRegion={bboxToRegion(map.terrain.bbox)}
				cameraZoomRange={CAMERA_ZOOM_RANGE}
				showsUserLocation={true}
				userInterfaceStyle="light"
			>
				<TerrainLayer terrain={map.terrain} />
				{map.controls.map((marker, index) => (
					<Marker key={index} coordinate={marker} />
				))}
			</MapView>

			<SafeAreaView style={styles.safeArea} pointerEvents="box-none" edges={['top']}>

				<View style={styles.header}>
					<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
						<Feather name="corner-up-left" size={28} color={Colors.light.text} />
					</TouchableOpacity>
				</View>

				<View style={styles.bottomCard}>
					<Text style={styles.cardTitle}>{map.name}</Text>
					<Text style={styles.cardDesc}>{map.description}</Text>

					<View style={styles.tagsContainer}>
						<View style={styles.tag}>
							<Feather name="map" size={14} color={Colors.light.textMuted} style={styles.tagIcon} />
							<Text style={styles.tagText}>4,0 km</Text>
						</View>
						<View style={styles.tag}>
							<Feather name="map-pin" size={14} color={Colors.light.textMuted} style={styles.tagIcon} />
							<Text style={styles.tagText}>{map.controls.length} kontroller</Text>
						</View>
						<View style={styles.tag}>
							<Feather name="bar-chart-2" size={14} color={Colors.light.accent} style={styles.tagIcon} />
							<Text style={styles.tagText}>{getDifficultyInfo(map.difficulty)}</Text>
						</View>
					</View>

					{/* 3. Knappen är nu mycket renare eftersom logiken ligger i toppen */}
					<TouchableOpacity style={styles.startButton} onPress={handlePress}>
						<Text style={styles.startButtonText}>{buttonText}</Text>
					</TouchableOpacity>

				</View>
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.light.beigeBgDarker,
	},
	safeArea: {
		flex: 1,
		justifyContent: 'space-between',
	},
	header: {
		flexDirection: 'row',
		paddingHorizontal: 20,
		paddingTop: 10,
	},
	backButton: {
		backgroundColor: 'rgba(255, 255, 255, 0.8)',
		borderRadius: 50,
		padding: 8,
	},
	bottomCard: {
		backgroundColor: Colors.light.cardBg,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		padding: 25,
		paddingBottom: 40,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -2 },
		shadowOpacity: 0.1,
		shadowRadius: 10,
		elevation: 10,
	},
	cardTitle: {
		fontSize: 22,
		fontWeight: 'bold',
		marginBottom: 4,
		color: Colors.light.textMain,
	},
	cardDesc: {
		fontSize: 14,
		color: Colors.light.textMuted,
		marginBottom: 20,
	},
	tagsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 30,
	},
	tag: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: Colors.light.beigeBg,
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: Colors.light.border,
	},
	tagIcon: {
		marginRight: 6,
	},
	tagText: {
		fontSize: 12,
		fontWeight: '600',
		color: Colors.light.textMain,
	},
	startButton: {
		backgroundColor: Colors.light.primary,
		borderRadius: 8,
		paddingVertical: 18,
		alignItems: 'center',
	},
	startButtonText: {
		color: Colors.light.background,
		fontSize: 18,
		fontWeight: 'bold',
	},
});
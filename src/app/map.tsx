import { useLocation } from '@/hooks/use-location';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useProgress } from '@/context/ProgressContext';
import { getMapById } from '@/data/maps';
import { bboxToRegion } from '@/utilities/bboxToRegion';

const ROAD_OUTLINE_COLOR = '#000000';

function getTerrainColor(kind: string): string {
	switch (kind) {
		case 'open': return '#CDEBB0';
		case 'forest': return '#789c6f';
		case 'marsh': return 'rgba(0, 255, 255, 0.5)';
		case 'water': return '#0399D9';
		case 'building': return 'rgb(0, 0, 0)';
		case 'stream': return '#8BE1F7';
		case 'road': return '#b5793f'; // brun – måste vara ogenomskinlig, annars syns den svarta kanten igenom
		case 'path': return '#000000';
		default: return 'rgba(0, 0, 0, 0.5)';
	}
}

// Hur mycket linjerna får krympa/växa jämfört med startzoomen,
// så att de varken försvinner helt eller blir enorma.
const MIN_ZOOM_SCALE = 0.2;
const MAX_ZOOM_SCALE = 4;

/**
 * Linjebredder anges i skärmpixlar och ändras inte när man zoomar.
 * `scale` räknar om dem så att de följer kartan, som på en papperskarta.
 */
function renderTerrainFeature(feature: any, index: number, scale: number) {
	const { kind, shape, coordinates } = feature;
	if (shape === 'line') {
		if (feature.kind === 'path') {
			return <Polyline key={index} coordinates={coordinates} strokeColor={getTerrainColor(kind)} strokeWidth={1 * scale} lineDashPattern={[2 * scale, 3 * scale]} />;
		}
		else if (kind === 'road') {
			return (
				<Fragment key={index}>
					<Polyline coordinates={coordinates} strokeColor={ROAD_OUTLINE_COLOR} strokeWidth={5 * scale} />
					<Polyline coordinates={coordinates} strokeColor={getTerrainColor(kind)} strokeWidth={3 * scale} />
				</Fragment>
			);
		}
		else
			return <Polyline key={index} coordinates={coordinates} strokeColor={getTerrainColor(kind)} strokeWidth={3 * scale} />;
	} else if (shape === 'polygon') {
		return <Polygon key={index} coordinates={coordinates} fillColor={getTerrainColor(kind)} strokeColor={getTerrainColor(kind)} strokeWidth={1 * scale} holes={feature.holes} />;
	}
	return null;
}

function getDifficultyInfo(difficulty: string) {
	switch (difficulty) {
		case 'Easy': return 'Lätt';
		case 'Medium': return 'Medelsvår';
		case 'Hard': return 'Svår';
		default: return 'Okänd';
	}
}

export default function MapDetailScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams();

	// 1. VIKTIGT: Vi flyttar upp useProgress() hit till toppen!
	const { startedMaps, completedMaps, startMap, completeMap } = useProgress();
	// Hooks måste anropas före alla tidiga return
	const { location } = useLocation();
	// 1 = startzoomen. Mindre än 1 när man zoomat ut, större när man zoomat in.
	const [zoomScale, setZoomScale] = useState(1);

	const mapId = Array.isArray(id) ? id[0] : id;
	const map = getMapById(mapId || 'berghem');

	if (!map || !map.terrain) {
		return (
			<View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
				<Text style={{ color: Colors.light.text }}>Kartan laddas eller saknas...</Text>
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

	const initialRegion = bboxToRegion(map.bbox);

	const handleRegionChange = (region: Region) => {
		// latitudeDelta = hur stort område som syns. Dubbelt så stort → hälften så tjocka linjer.
		const scale = initialRegion.latitudeDelta / region.latitudeDelta;
		setZoomScale(Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, scale)));
	};

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
				initialRegion={initialRegion}
				onRegionChangeComplete={handleRegionChange}
				showsUserLocation={true}
				userInterfaceStyle="light"
			>
				{map.terrain.features.map((feature, index) => renderTerrainFeature(feature, index, zoomScale))}
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
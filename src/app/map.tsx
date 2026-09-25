import { useLocation } from '@/hooks/use-location';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProgress } from '@/context/ProgressContext';
import { getMapById } from '@/data/maps';
import { bboxToRegion } from '@/utilities/bboxToRegion';

function getTerrainColor(kind: string): string {
	switch (kind) {
		case 'open': return 'rgba(255, 255, 0, 0.5)';
		case 'forest': return 'rgba(0, 128, 0, 0.5)';
		case 'marsh': return 'rgba(0, 255, 255, 0.5)';
		case 'water': return 'rgba(0, 0, 255, 0.5)';
		case 'building': return 'rgba(128, 128, 128, 0.5)';
		case 'stream': return 'rgba(0, 191, 255, 0.5)';
		case 'road': return 'rgba(255, 165, 0, 0.5)';
		case 'path': return 'rgba(139, 69, 19, 0.5)';
		default: return 'rgba(0, 0, 0, 0.5)';
	}
}

function renderTerrainFeature(feature: any, index: number) {
	const { kind, shape, coordinates } = feature;
	if (shape === 'line') {
		return <Polyline key={index} coordinates={coordinates} strokeColor={getTerrainColor(kind)} strokeWidth={3} />;
	} else if (shape === 'polygon') {
		return <Polygon key={index} coordinates={coordinates} fillColor={getTerrainColor(kind)} strokeColor={getTerrainColor(kind)} strokeWidth={1} holes={feature.holes} />;
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

	const mapId = Array.isArray(id) ? id[0] : id;
	const map = getMapById(mapId || 'campus');

	if (!map || !map.terrain) {
		return (
			<View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
				<Text>Kartan laddas eller saknas...</Text>
			</View>
		);
	}

	const { location } = useLocation();
	if (!location) {
		return (
			<View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
				<Text>Hämtar din position...</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>

			<MapView style={StyleSheet.absoluteFill} initialRegion={bboxToRegion(map.bbox)} showsUserLocation={true}>
				{map.terrain.features.map((feature, index) => renderTerrainFeature(feature, index))}
				{map.controls.map((marker, index) => (
					<Marker key={index} coordinate={marker} />
				))}
			</MapView>

			<SafeAreaView style={styles.safeArea} pointerEvents="box-none">

				<View style={styles.header}>
					<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
						<Feather name="corner-up-left" size={28} color="black" />
					</TouchableOpacity>
				</View>

				<View style={styles.bottomCard}>
					<Text style={styles.cardTitle}>{map.name}</Text>
					<Text style={styles.cardDesc}>{map.description}</Text>

					<View style={styles.tagsContainer}>
						<View style={styles.tag}>
							<Feather name="map" size={14} color="#555" style={styles.tagIcon} />
							<Text style={styles.tagText}>4,0 km</Text>
						</View>
						<View style={styles.tag}>
							<Feather name="map-pin" size={14} color="#555" style={styles.tagIcon} />
							<Text style={styles.tagText}>{map.controls.length} kontroller</Text>
						</View>
						<View style={styles.tag}>
							<Feather name="bar-chart-2" size={14} color="#C87B4E" style={styles.tagIcon} />
							<Text style={styles.tagText}>{getDifficultyInfo(map.difficulty)}</Text>
						</View>
					</View>

					{(() => {
						const { startedMaps, completedMaps, startMap, completeMap } = useProgress();

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
							<TouchableOpacity style={styles.startButton} onPress={handlePress}>
								<Text style={styles.startButtonText}>{buttonText}</Text>
							</TouchableOpacity>
						);
					})()}

				</View>
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#E8E5D9',
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
		backgroundColor: '#FFFFFF',
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
	},
	cardDesc: {
		fontSize: 14,
		color: '#555',
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
		backgroundColor: '#F5F4EE',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#E0E0E0',
	},
	tagIcon: {
		marginRight: 6,
	},
	tagText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#333',
	},
	startButton: {
		backgroundColor: '#4A5D4E',
		borderRadius: 8,
		paddingVertical: 18,
		alignItems: 'center',
	},
	startButtonText: {
		color: '#FFFFFF',
		fontSize: 18,
		fontWeight: 'bold',
	},
});
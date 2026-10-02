import { useLocation } from '@/hooks/use-location';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TerrainLayer } from '@/components/TerrainLayer';
import { Colors } from '@/constants/theme';
import { fetchMapWithTerrain, type MapWithTerrain } from '@/services/mapsDAL';
// Importera abandonRun
import { supabase } from '@/lib/supabase';
import { abandonRun, completeRun, createRun, fetchUserRuns } from '@/services/runsDAL';
import type { Difficulty } from '@/types';
import { bboxToRegion } from '@/utilities/bboxToRegion';

const CAMERA_ZOOM_RANGE = { minCenterCoordinateDistance: 1000, maxCenterCoordinateDistance: 6000 };

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
    const { location } = useLocation();

    const mapId = Array.isArray(id) ? id[0] : id;

    // Data-states
    const [map, setMap] = useState<MapWithTerrain | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    
    // Status-states för en run
    const [runStatus, setRunStatus] = useState<'not_started' | 'started' | 'completed'>('not_started');
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!mapId) return;
        
        async function loadMapAndRun() {
            try {
                // 1. Hämta kartan
                const mapResult = await fetchMapWithTerrain(mapId);
                if (mapResult) {
                    setMap(mapResult);
                } else {
                    setError('Kartan finns inte');
                    return;
                }

                // 2. Kolla användarens status på just denna karta
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUserId(user.id);
                    const userRuns = await fetchUserRuns(user.id);
                    
                    // Filtrera ut runs som tillhör den här specifika kartan
                    const runsForThisMap = userRuns.filter(r => r.mapId === mapId);
                    
                    if (runsForThisMap.some(r => r.isCompleted)) {
                        setRunStatus('completed');
                        // Spara ID:t för det avklarade loppet så vi kan ta bort det om man vill börja om
                        const completedRun = runsForThisMap.find(r => r.isCompleted);
                        if (completedRun) setActiveRunId(completedRun.id);
                    } else {
                        const active = runsForThisMap.find(r => !r.isCompleted);
                        if (active) {
                            setRunStatus('started');
                            setActiveRunId(active.id);
                        }
                    }
                }
            } catch (e: any) {
                setError(e.message);
            }
        }

        loadMapAndRun();
    }, [mapId]);

    if (!mapId || error) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: Colors.light.textMain }}>{error ?? 'Ingen karta vald'}</Text>
            </View>
        );
    }

    if (!map) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: Colors.light.textMain }}>Kartan laddas...</Text>
            </View>
        );
    }

    if (!location) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: Colors.light.textMain }}>Hämtar din position...</Text>
            </View>
        );
    }

    // Hantera huvudknappen (Starta eller Avsluta databas-run)
    const handlePress = async () => {
        if (!userId || isProcessing) return;
        setIsProcessing(true);
        
        try {
            if (runStatus === 'completed') {
                router.back();
            } else if (runStatus === 'started' && activeRunId) {
                // Avsluta run med 0 i tid och tom kontroll-lista tillfälligt för test
                await completeRun(activeRunId, 0, []);
                setRunStatus('completed');
                router.back(); 
            } else {
                // Starta ny run
                const newRun = await createRun(userId, map.id);
                setActiveRunId(newRun.id);
                setRunStatus('started');
            }
        } catch (e) {
            console.error("Fel vid hantering av runs:", e);
        } finally {
            setIsProcessing(false);
        }
    };

    // Hantera "Börja om"-knappen
    const handleRestart = async () => {
        if (!activeRunId || isProcessing) return;
        setIsProcessing(true);
        
        try {
            await abandonRun(activeRunId); // Tar bort raden från databasen
            setRunStatus('not_started');
            setActiveRunId(null);
            router.back(); // Backar till listan så man direkt ser att den flyttat till "Nya"
        } catch (e) {
            console.error("Fel vid borttagning av run:", e);
        } finally {
            setIsProcessing(false);
        }
    };

    let buttonText = 'Starta bana';
    if (runStatus === 'completed') buttonText = 'Se resultat';
    if (runStatus === 'started') buttonText = 'Avsluta orientering (Test)';

    const distanceDisplay = map.distanceM 
        ? `${(map.distanceM / 1000).toFixed(1).replace('.', ',')} km` 
        : 'Okänd längd';

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
                        <Feather name="corner-up-left" size={28} color={Colors.light.textMain} />
                    </TouchableOpacity>
                </View>

                <View style={styles.bottomCard}>
                    <Text style={styles.cardTitle}>{map.name}</Text>
                    <Text style={styles.cardDesc}>{map.description}</Text>

                    <View style={styles.tagsContainer}>
                        <View style={styles.tag}>
                            <Feather name="map" size={14} color={Colors.light.textMuted} style={styles.tagIcon} />
                            <Text style={styles.tagText}>{distanceDisplay}</Text>
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

                    <TouchableOpacity 
                        style={[styles.startButton, isProcessing && { opacity: 0.7 }]} 
                        onPress={handlePress}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color={Colors.light.background} />
                        ) : (
                            <Text style={styles.startButtonText}>{buttonText}</Text>
                        )}
                    </TouchableOpacity>

                    {/* Visas bara om banan är påbörjad eller avklarad */}
                    {runStatus !== 'not_started' && (
                        <TouchableOpacity 
                            style={[styles.restartButton, isProcessing && { opacity: 0.7 }]} 
                            onPress={handleRestart}
                            disabled={isProcessing}
                        >
                            <Text style={styles.restartButtonText}>
                                {runStatus === 'completed' ? 'Börja om från noll' : 'Avbryt pågående lopp'}
                            </Text>
                        </TouchableOpacity>
                    )}

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
    restartButton: {
        marginTop: 12,
        paddingVertical: 16,
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D32F2F', // Röd varningsfärg
        backgroundColor: 'transparent',
    },
    restartButtonText: {
        color: '#D32F2F',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
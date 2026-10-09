import { useLocation } from '@/hooks/use-location';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StyleSheet, Text, TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TerrainLayer } from '@/components/TerrainLayer';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { fetchMapWithTerrain, type MapWithTerrain } from '@/services/mapsDAL';
import { abandonRun, completeRun, createRun, fetchUserRuns, updateRunTime, updateVisitedControls, type RunSummary } from '@/services/runsDAL';
import type { Difficulty } from '@/types';
import { bboxToRegion } from '@/utilities/bboxToRegion';

const CAMERA_ZOOM_RANGE = { minCenterCoordinateDistance: 500, maxCenterCoordinateDistance: 25000 };

function getDifficultyInfo(difficulty: Difficulty) {
    switch (difficulty) {
        case 'easy': return 'Lätt';
        case 'medium': return 'Medelsvår';
        case 'hard': return 'Svår';
    }
}

function getDifficultyIcon(difficulty: Difficulty) {
    switch (difficulty) {
        case 'easy': return require('@/assets/HiFi/icon_easy.png');
        case 'medium': return require('@/assets/HiFi/icon_medium.png');
        case 'hard': return require('@/assets/HiFi/icon_hard.png');
    }
}

function formatMsToTime(ms: number) {
    if (!ms || ms === 0) return "0:00";
    return formatSecondsToTime(Math.floor(ms / 1000));
}

function formatSecondsToTime(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function MapDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { location } = useLocation();

    const mapId = Array.isArray(id) ? id[0] : id;

    const [map, setMap] = useState<MapWithTerrain | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    
    const [runStatus, setRunStatus] = useState<'not_started' | 'started' | 'completed'>('not_started');
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const [currentRun, setCurrentRun] = useState<RunSummary | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [showResultModal, setShowResultModal] = useState(false);

    // --- ANIMATION & GESTURE LOGIC ---
    const panY = useRef(new Animated.Value(0)).current;
    const lastY = useRef(0); 
    const hiddenHeightRef = useRef(200); 

    const animateMenuDown = () => {
        setTimeout(() => {
            const downPosition = hiddenHeightRef.current;
            Animated.spring(panY, {
                toValue: downPosition, 
                useNativeDriver: false,
            }).start();
            lastY.current = downPosition;
        }, 50);
    };

    const animateMenuUp = () => {
        Animated.spring(panY, {
            toValue: 0, 
            useNativeDriver: false,
        }).start();
        lastY.current = 0;
    };
    
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dy) > 10;
            },
            onPanResponderGrant: () => {
                panY.setOffset(lastY.current);
                panY.setValue(0);
            },
            onPanResponderMove: (_, gestureState) => {
                panY.setValue(gestureState.dy);
            },
            onPanResponderRelease: (_, gestureState) => {
                panY.flattenOffset();
                
                const downPosition = hiddenHeightRef.current;
                
                if (gestureState.vy > 0.5 || gestureState.dy > 50) {
                    Animated.spring(panY, {
                        toValue: downPosition, 
                        useNativeDriver: false,
                    }).start();
                    lastY.current = downPosition;
                } 
                else if (gestureState.vy < -0.5 || gestureState.dy < -50) {
                    Animated.spring(panY, {
                        toValue: 0, 
                        useNativeDriver: false,
                    }).start();
                    lastY.current = 0;
                } 
                else {
                    Animated.spring(panY, {
                        toValue: lastY.current,
                        useNativeDriver: false,
                    }).start();
                }
            }
        })
    ).current;

    const translateY = panY.interpolate({
        inputRange: [0, 800],
        outputRange: [0, 800],
        extrapolate: 'clamp',
    });

    useEffect(() => {
        animateMenuUp();
    }, [mapId]);

    // --- DATABAS & EFFEKTER ---
    useEffect(() => {
        if (!mapId) return;
        
        async function loadMapAndRun() {
            try {
                const mapResult = await fetchMapWithTerrain(mapId);
                if (mapResult) {
                    setMap(mapResult);
                } else {
                    setError('Kartan finns inte');
                    return;
                }

                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUserId(user.id);
                    const userRuns = await fetchUserRuns(user.id);
                    const runsForThisMap = userRuns.filter(r => r.mapId === mapId);
                    
                    if (runsForThisMap.some(r => r.isCompleted)) {
                        setRunStatus('completed');
                        const completedRun = runsForThisMap.find(r => r.isCompleted);
                        if (completedRun) {
                            setActiveRunId(completedRun.id);
                            setCurrentRun(completedRun);
                        }
                    } else {
                        const active = runsForThisMap.find(r => !r.isCompleted);
                        if (active) {
                            setRunStatus('started');
                            setActiveRunId(active.id);
                            setCurrentRun(active);
                            setElapsedSeconds(Math.floor(active.elapsedMs / 1000));
                            setIsTimerRunning(false); 
                        }
                    }
                }
            } catch (e: any) {
                setError(e.message);
            }
        }
        loadMapAndRun();
    }, [mapId]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (runStatus === 'started' && isTimerRunning) {
            interval = setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [runStatus, isTimerRunning]);

    const handleBack = async () => {
        if (runStatus === 'started' && isTimerRunning && activeRunId) {
            try {
                await updateRunTime(activeRunId, elapsedSeconds * 1000);
            } catch (e) {
                console.error("Kunde inte autospara tiden:", e);
            }
        }
        router.back();
    };

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
                <ActivityIndicator size="large" color="#4A5D4E" />
            </View>
        );
    }

    const handlePress = async () => {
        if (!userId || isProcessing) return;
        setIsProcessing(true);
        
        try {
            if (runStatus === 'completed') {
                if (activeRunId) await abandonRun(activeRunId);
                setRunStatus('not_started');
                setActiveRunId(null);
                setCurrentRun(null);
                setElapsedSeconds(0);
                setIsTimerRunning(false);
                
                animateMenuUp();
            } 
            else if (runStatus === 'started' && activeRunId) {
                if (isTimerRunning) {
                    setIsTimerRunning(false);
                    await updateRunTime(activeRunId, elapsedSeconds * 1000);
                    
                    router.replace('/?tab=Påbörjade'); 
                } else {
                    setIsTimerRunning(true);
                    animateMenuDown();
                }
            } 
            else {
                const newRun = await createRun(userId, map.id);
                setActiveRunId(newRun.id);
                setCurrentRun(newRun);
                setRunStatus('started');
                setElapsedSeconds(0);
                setIsTimerRunning(true);
                
                animateMenuDown();
            }
        } catch (e) {
            console.error("Fel vid hantering av runs:", e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleStamp = async () => {
        if (!isTimerRunning || !activeRunId || !currentRun || isProcessing) return;
        setIsProcessing(true);
        
        try {
            const visitedCount = currentRun.visitedControls?.length || 0;
            const nextControl = map.controls[visitedCount];
            
            if (nextControl) {
                const newVisited = [...(currentRun.visitedControls || []), nextControl];
                const updatedRun = await updateVisitedControls(activeRunId, newVisited);
                setCurrentRun(updatedRun);
                
                if (newVisited.length >= map.controls.length) {
                    setIsTimerRunning(false);
                    const finalTimeMs = elapsedSeconds * 1000;
                    const finishedRun = await completeRun(activeRunId, finalTimeMs, newVisited);
                    setCurrentRun(finishedRun);
                    setRunStatus('completed');
                    setShowResultModal(true);
                    
                    animateMenuUp();
                }
            }
        } catch (e) {
            console.error("Fel vid stämpling:", e);
        } finally {
            setIsProcessing(false);
        }
    };

    let buttonText = 'Starta karta';
    if (runStatus === 'started') buttonText = isTimerRunning ? 'Pausa karta' : 'Återuppta karta';
    if (runStatus === 'completed') buttonText = 'Kör om karta';

    const distanceDisplay = map.distanceM ? `${(map.distanceM / 1000).toFixed(1).replace('.', ',')} km` : 'Okänd';
    const visitedControlsCount = currentRun?.visitedControls?.length || 0;
    const progressPct = map.controls.length > 0 ? (visitedControlsCount / map.controls.length) * 100 : 0;

    return (
        <View style={styles.container}>
            <MapView
                key={map.id} 
                style={StyleSheet.absoluteFill}
                initialRegion={bboxToRegion(map.terrain.bbox)} 
                cameraZoomRange={CAMERA_ZOOM_RANGE}
                showsUserLocation={true}
                userInterfaceStyle="light"
            >
                <TerrainLayer terrain={map.terrain} />
                
                {map.controls.map((marker, index) => {
                    const isVisited = visitedControlsCount > index || runStatus === 'completed';
                    return (
                        <Marker key={index} coordinate={marker} anchor={{x: 0.5, y: 0.5}}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.markerNumber}>{index + 1}</Text>
                                <View style={[styles.markerDot, isVisited && styles.markerDotVisited]} />
                            </View>
                        </Marker>
                    );
                })}
            </MapView>

            <SafeAreaView style={styles.safeArea} pointerEvents="box-none" edges={['top']}>
                
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <Feather name="corner-up-left" size={28} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{map.name}</Text>
                    <View style={{ width: 28 }} />
                </View>

                <Animated.View 
                    style={[styles.bottomCard, { transform: [{ translateY }] }]}
                    {...panResponder.panHandlers}
                >
                    <View style={styles.dragHandleContainer}>
                        <View style={styles.dragHandle} />
                    </View>

                    <Text style={styles.cardTitle}>{map.name}</Text>

                    <View style={styles.tagsContainer}>
                        <View style={styles.tag}>
                            <Image source={require('@/assets/HiFi/path_distance_icon.png')} style={styles.tagImageIcon} />
                            <Text style={styles.tagText}>{distanceDisplay}</Text>
                        </View>
                        <View style={styles.tag}>
                            <Image source={require('@/assets/HiFi/controll_icon.png')} style={styles.tagImageIcon} />
                            <Text style={styles.tagText}>{map.controls.length} kontroller</Text>
                        </View>
                        <View style={styles.tag}>
                            <Image source={getDifficultyIcon(map.difficulty)} style={styles.tagImageIcon} />
                            <Text style={styles.tagText}>{getDifficultyInfo(map.difficulty)}</Text>
                        </View>
                    </View>

                    <View onLayout={(event) => {
                        hiddenHeightRef.current = event.nativeEvent.layout.height + 40;
                    }}>
                        {runStatus === 'started' && (
                            <View style={styles.infoBoxOngoing}>
                                <View style={styles.infoBoxRow}>
                                    <View style={styles.infoBoxCol}>
                                        <Text style={styles.infoBoxBigText}>{visitedControlsCount} av {map.controls.length}</Text>
                                        <Text style={styles.infoBoxSmallText}>Kontroller tagna</Text>
                                    </View>
                                    <View style={styles.infoDivider} />
                                    <View style={styles.infoBoxCol}>
                                        <Text style={styles.infoBoxBigText}>{formatSecondsToTime(elapsedSeconds)}</Text>
                                        <Text style={styles.infoBoxSmallText}>Tid åtgången</Text>
                                    </View>
                                </View>
                                <View style={styles.progressTrack}>
                                    <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                                </View>
                            </View>
                        )}

                        {runStatus === 'completed' && (
                            <TouchableOpacity style={styles.infoBoxCompleted} onPress={() => setShowResultModal(true)}>
                                <Feather name="clock" size={24} color="#000" />
                                <View style={{ alignItems: 'center', flex: 1 }}>
                                    <Text style={styles.infoBoxBigText}>{formatMsToTime(currentRun?.elapsedMs || 0)}</Text>
                                    <Text style={styles.infoBoxSmallText}>Tid senast avklarad karta</Text>
                                </View>
                                <Feather name="chevron-right" size={24} color="#000" />
                            </TouchableOpacity>
                        )}

                        {runStatus === 'started' && (
                            <TouchableOpacity 
                                style={[styles.stampButton, (!isTimerRunning || isProcessing) && { opacity: 0.5 }]} 
                                onPress={handleStamp}
                                disabled={!isTimerRunning || isProcessing}
                            >
                                <Text style={styles.stampButtonText}>Stämpla nästa kontroll (Simulator)</Text>
                            </TouchableOpacity>
                        )}

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
                    </View>
                </Animated.View>
            </SafeAreaView>

            <Modal visible={showResultModal} animationType="slide" transparent={true}>
                <View style={styles.resultModalContainer}>
                    <SafeAreaView style={{flex: 1}} edges={['top', 'bottom']}>
                        <View style={styles.resultHeader}>
                            {/* Krysset stänger modalen och skickar dig till Avklarade-tabben */}
                            <TouchableOpacity 
                                onPress={() => {
                                    setShowResultModal(false);
                                    router.replace('/?tab=Avklarade');
                                }} 
                                style={styles.resultCloseButton}
                            >
                                <Feather name="x" size={28} color="#000" />
                            </TouchableOpacity>
                            <Text style={styles.resultHeaderTitle}>Avklarad karta</Text>
                            <View style={{ width: 28 }} /> 
                        </View>

                        <ScrollView contentContainerStyle={styles.resultScrollContent} showsVerticalScrollIndicator={false}>
                            <View style={styles.resultTopCard}>
                                <View style={styles.resultCheckCircle}>
                                    <Feather name="check" size={24} color="#4A5D4E" />
                                </View>
                                <Text style={styles.resultMapName}>{map.name}</Text>
                                <Text style={styles.resultSubText}>Sluttid:</Text>
                                <Text style={styles.resultTimeBig}>
                                    {currentRun ? formatMsToTime(currentRun.elapsedMs) : '0:00'}
                                </Text>
                            </View>

                            <View style={styles.timelineContainer}>
                                {map.controls.map((_, i) => {
                                    const totalTime = currentRun?.elapsedMs || 0;
                                    const mockSplitMs = (totalTime / map.controls.length) * (i + 1);

                                    return (
                                        <View key={i} style={styles.timelineItem}>
                                            <View style={styles.timelineLeft}>
                                                <View style={styles.timelineDot}>
                                                    <Feather name="check" size={14} color="#FFF" />
                                                </View>
                                                {i < map.controls.length - 1 && <View style={styles.timelineLine} />}
                                            </View>
                                            <View style={styles.timelinePillContainer}>
                                                <View style={styles.timelinePill}>
                                                    <Text style={styles.timelinePillText}>
                                                        Kontroll {i + 1}: {formatMsToTime(mockSplitMs)}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.beigeBgDarker },
    safeArea: { flex: 1, justifyContent: 'space-between' },
    
    header: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 10, alignItems: 'center', justifyContent: 'space-between' },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },

    markerNumber: { fontSize: 14, fontWeight: 'bold', color: '#000', marginRight: 4 },
    markerDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#A56A41', backgroundColor: '#FFF' },
    markerDotVisited: { backgroundColor: '#A56A41' },

    bottomCard: { 
        backgroundColor: '#FFF', 
        borderTopLeftRadius: 24, 
        borderTopRightRadius: 24, 
        paddingHorizontal: 25,
        paddingTop: 15,
        paddingBottom: 40, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: -2 }, 
        shadowOpacity: 0.1, 
        shadowRadius: 10, 
        elevation: 10 
    },
    
    dragHandleContainer: { width: '100%', alignItems: 'center', paddingBottom: 20 },
    dragHandle: { width: 40, height: 5, backgroundColor: '#D1D3C4', borderRadius: 3 },
    
    cardTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#000' },
    
    tagsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5EC', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0D1' },
    tagImageIcon: { width: 14, height: 14, marginRight: 6, resizeMode: 'contain' },
    tagText: { fontSize: 11, fontWeight: '600', color: '#000' },

    infoBoxOngoing: { backgroundColor: '#F0EFE6', borderRadius: 8, padding: 16, marginBottom: 20 },
    infoBoxCompleted: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0EFE6', borderRadius: 8, padding: 16, marginBottom: 20 },
    infoBoxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    infoBoxCol: { flex: 1, alignItems: 'center' },
    infoDivider: { width: 1, height: '100%', backgroundColor: '#CCC', marginHorizontal: 10 },
    infoBoxBigText: { fontSize: 18, fontWeight: 'bold', color: '#000' },
    infoBoxSmallText: { fontSize: 12, color: '#666', marginTop: 2 },
    progressTrack: { height: 12, backgroundColor: '#D1D3C4', borderRadius: 6, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#4A5D4E', borderRadius: 6 },

    stampButton: { backgroundColor: 'transparent', borderRadius: 8, borderWidth: 2, borderColor: '#4A5D4E', paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
    stampButtonText: { color: '#4A5D4E', fontSize: 16, fontWeight: 'bold' },

    startButton: { backgroundColor: '#4A5D4E', borderRadius: 8, paddingVertical: 18, alignItems: 'center' },
    startButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },

    resultModalContainer: { flex: 1, backgroundColor: '#F5F5EC' },
    resultHeader: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingHorizontal: 20, 
        paddingBottom: 15,
        paddingTop: Platform.OS === 'ios' ? 60 : 30, 
    },
    resultCloseButton: { padding: 5 },
    resultHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
    resultScrollContent: { paddingBottom: 40 },
    resultTopCard: { backgroundColor: '#DCE1D3', borderRadius: 12, margin: 20, paddingVertical: 35, alignItems: 'center' },
    resultCheckCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#4A5D4E', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    resultMapName: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 16 },
    resultSubText: { fontSize: 14, color: '#555', marginBottom: 4 },
    resultTimeBig: { fontSize: 42, fontWeight: 'bold', color: '#000' },
    timelineContainer: { paddingHorizontal: 25, marginTop: 10 },
    timelineItem: { flexDirection: 'row' },
    timelineLeft: { width: 30, alignItems: 'center' },
    timelineDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#C48B5D', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    timelineLine: { width: 2, flex: 1, backgroundColor: '#C48B5D', marginTop: -4, marginBottom: -4, zIndex: 1 },
    timelinePillContainer: { flex: 1, paddingLeft: 12, paddingBottom: 16 },
    timelinePill: { backgroundColor: '#FFF', borderRadius: 8, padding: 16, justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1 },
    timelinePillText: { fontSize: 15, fontWeight: '500', color: '#000' },
});
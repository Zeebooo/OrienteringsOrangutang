import { useLocation } from '@/hooks/use-location';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TerrainLayer } from '@/components/TerrainLayer';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { fetchMapWithTerrain, type MapWithTerrain } from '@/services/mapsDAL';
import { abandonRun, completeRun, createRun, fetchUserRuns, updateRunTime, updateVisitedControls, type RunSummary } from '@/services/runsDAL';
import type { Difficulty } from '@/types';
import { bboxToRegion } from '@/utilities/bboxToRegion';
import { distanceInMeters } from '@/utilities/geo';

const CAMERA_ZOOM_RANGE = { minCenterCoordinateDistance: 500, maxCenterCoordinateDistance: 25000 };
const COMPASS_SIZE = 44;

// Automatisk stämpling: så nära (meter) och så länge (ms) man måste vara vid nästa kontroll.
// GPS i telefoner är ofta ±5–10 m, så radien får inte vara för liten.
const STAMP_RADIUS_M = 15;
const STAMP_DWELL_MS = 4000;
const STAMP_FILL_TICK_MS = 100; // hur ofta fyllnaden uppdateras
const STAMP_HAPTIC_BPM = 290; // vibrationens takt medan kontrollen fylls (290 bpm ≈ var 207:e ms)
const BIG_CONTROL_ICON = require('@/assets/HiFi/big_control_icon.png');
const MARKER_SIZE = 34;
// Knallorange så att kontrollerna sticker ut mot terrängens gröna och bruna färger
const CONTROL_ORANGE = '#FF6B00';

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
    // Användarens position syns inte på kartan från början – det ska vara orientering, inte GPS-navigering
    const [showLocation, setShowLocation] = useState(false);

    // Egen kompass: kartans inbyggda försvinner när kartan pekar mot norr.
    // Riktningen ligger i ett Animated.Value, så kompassen kan vrida sig utan att hela skärmen ritas om.
    const mapRef = useRef<MapView>(null);
    const [heading] = useState(() => new Animated.Value(0));
    const compassRotation = heading.interpolate({
        inputRange: [0, 360],
        outputRange: ['0deg', '-360deg'],
    });

    const updateHeading = async () => {
        try {
            const camera = await mapRef.current?.getCamera();
            if (camera) heading.setValue(camera.heading);
        } catch {
            // Kartan kan anropa det här när den inbyggda kartvyn inte finns (när den skapas,
            // byggs om eller när skärmen lämnas). Då hoppar vi bara över uppdateringen.
        }
    };

    const resetToNorth = () => {
        mapRef.current?.animateCamera({ heading: 0 }, { duration: 300 });
    };

    // Positionsknappen ligger strax ovanför panelen längst ner, så den behöver panelens höjd
    const [cardHeight, setCardHeight] = useState(0);

    // Kontrollen man tryckt på – visar dess namn och när den togs
    const [selectedControlIndex, setSelectedControlIndex] = useState<number | null>(null);
    const [infoCardHeight, setInfoCardHeight] = useState(0);

    // Popupen som visas när en kontroll har tagits
    const [stampedPopup, setStampedPopup] = useState<{ index: number; elapsedMs: number } | null>(null);

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

    // --- STÄMPLING ---

    // Kontrollerna kan tas i vilken ordning som helst, så "tagen" avgörs av id – inte av plats i listan
    const visitedIds = new Set((currentRun?.visitedControls ?? []).map((v) => v.id));

    /** Stämplar kontrollen med index `controlIndex`. Används både av närhetskontrollen och simulatorknappen. */
    const stampControl = async (controlIndex: number) => {
        if (!map || !isTimerRunning || !activeRunId || !currentRun || isProcessing) return;
        const control = map.controls[controlIndex];
        if (!control || visitedIds.has(control.id)) return;
        setIsProcessing(true);

        try {
            // Timerns värde sparas med stämplingen, så att man kan se när kontrollen togs
            const elapsedMs = elapsedSeconds * 1000;
            const stamp = { ...control, elapsedMs };
            const newVisited = [...(currentRun.visitedControls || []), stamp];
            const updatedRun = await updateVisitedControls(activeRunId, newVisited);
            setCurrentRun(updatedRun);
            // En tydlig "klar"-vibration när kontrollen är tagen
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

            if (newVisited.length >= map.controls.length) {
                // Sista kontrollen – resultatrutan tar över i stället för popupen
                setIsTimerRunning(false);
                const finishedRun = await completeRun(activeRunId, elapsedMs, newVisited);
                setCurrentRun(finishedRun);
                setRunStatus('completed');
                setShowResultModal(true);
                animateMenuUp();
            } else {
                setStampedPopup({ index: controlIndex, elapsedMs });
            }
        } catch (e) {
            console.error("Fel vid stämpling:", e);
        } finally {
            setIsProcessing(false);
        }
    };

    // Närhetskontroll: den närmaste ej tagna kontrollen inom STAMP_RADIUS_M.
    // Räknas ut från positionen från useLocation, så det fungerar oavsett om pricken visas på kartan.
    const canStamp = runStatus === 'started' && isTimerRunning && !isProcessing && !stampedPopup;
    let nearControlIndex: number | null = null;
    if (canStamp && map && location) {
        let nearestDistance = STAMP_RADIUS_M;
        for (let index = 0; index < map.controls.length; index++) {
            const control = map.controls[index];
            if (visitedIds.has(control.id)) continue;
            const distance = distanceInMeters(location, control);
            if (distance <= nearestDistance) {
                nearestDistance = distance;
                nearControlIndex = index;
            }
        }
    }

    // Senaste versionen av stampControl – intervallet nedan behöver aktuell tid och aktuellt lopp
    const stampControlRef = useRef(stampControl);
    useEffect(() => {
        stampControlRef.current = stampControl;
    });

    // Fyller kontrollen gradvis medan man står kvar. När den är full stämplas den.
    // Byter man kontroll eller går för långt bort börjar det om, eftersom effekten körs om.
    const [stampFill, setStampFill] = useState<{ index: number; progress: number } | null>(null);
    useEffect(() => {
        if (nearControlIndex === null) return;
        const index = nearControlIndex;
        const startedAt = Date.now();

        // Telefonen vibrerar i takt (STAMP_HAPTIC_BPM) så länge kontrollen fylls
        const vibrate = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        vibrate();
        const hapticInterval = setInterval(vibrate, 60_000 / STAMP_HAPTIC_BPM);

        const interval = setInterval(() => {
            const progress = Math.min(1, (Date.now() - startedAt) / STAMP_DWELL_MS);
            setStampFill({ index, progress });
            if (progress >= 1) {
                clearInterval(interval);
                clearInterval(hapticInterval);
                stampControlRef.current(index);
            }
        }, STAMP_FILL_TICK_MS);

        // Körs när man går därifrån, byter kontroll eller när kontrollen tagits – vibrationen slutar direkt
        return () => {
            clearInterval(interval);
            clearInterval(hapticInterval);
        };
    }, [nearControlIndex]);

    // Fyllnaden visas bara för kontrollen man står vid just nu
    const fillProgressFor = (index: number) =>
        nearControlIndex === index && stampFill?.index === index ? stampFill.progress : 0;

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

    // Simulatorknappen – stämplar utan att man behöver vara på plats
    const handleStamp = () => {
        const firstNotTaken = map.controls.findIndex((c) => !visitedIds.has(c.id));
        if (firstNotTaken !== -1) stampControl(firstNotTaken);
    };

    let buttonText = 'Starta karta';
    if (runStatus === 'started') buttonText = isTimerRunning ? 'Pausa karta' : 'Återuppta karta';
    if (runStatus === 'completed') buttonText = 'Kör om karta';

    const distanceDisplay = map.distanceM ? `${(map.distanceM / 1000).toFixed(1).replace('.', ',')} km` : 'Okänd';
    const visitedControlsCount = currentRun?.visitedControls?.length || 0;
    const progressPct = map.controls.length > 0 ? (visitedControlsCount / map.controls.length) * 100 : 0;

    // Man kan trycka på kontroller när ett lopp är igång eller avklarat
    const canInspectControls = runStatus !== 'not_started';
    const selectedControl = selectedControlIndex !== null ? map.controls[selectedControlIndex] : null;
    const selectedInfo = canInspectControls && selectedControl && selectedControlIndex !== null
        ? getControlInfo(selectedControlIndex)
        : null;

    function getControlInfo(index: number) {
        const control = map!.controls[index];
        const number = index + 1;
        const defaultName = `Kontroll ${number}`;
        const visited = currentRun?.visitedControls ?? [];
        // Kontroller kan tas i vilken ordning som helst, så stämplingen letas upp på id
        const stamp = visited.find((v) => v.id === control.id);
        const isTaken = stamp !== undefined || runStatus === 'completed';

        let status = 'Ej tagen';
        if (stamp?.elapsedMs !== undefined) status = formatMsToTime(stamp.elapsedMs);
        else if (isTaken) status = 'Tagen'; // äldre stämplingar har ingen sparad tid

        return {
            name: control.description?.trim() || defaultName,
            // Visa "Kontroll 3" under namnet bara om namnet inte redan är just det
            subtitle: control.description?.trim() && control.description.trim() !== defaultName ? defaultName : null,
            status,
            isTaken,
            elapsedMs: stamp?.elapsedMs,
        };
    }

    // Resultatrutans ordning: kontrollerna sorterade efter när de togs.
    // Kontroller utan sparad tid (äldre lopp) hamnar sist, i banans ordning.
    const resultOrder = map.controls
        .map((_, index) => index)
        .sort((a, b) => (getControlInfo(a).elapsedMs ?? Infinity) - (getControlInfo(b).elapsedMs ?? Infinity));

    const handleMapPress = (e: MapPressEvent) => {
        // På Android skickas även tryck på en kontroll till kartan – de ska inte stänga rutan
        if (e.nativeEvent.action === 'marker-press') return;
        setSelectedControlIndex(null);
    };

    return (
        <View style={styles.container}>
            <MapView
                key={map.id}
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                showsPointsOfInterests={false} // döljer platser som "Umeå Universitet", affärer m.m.
                showsCompass={false}
                onRegionChange={updateHeading}
                onRegionChangeComplete={updateHeading}
                onPress={handleMapPress}
                initialRegion={bboxToRegion(map.terrain.bbox)} 
                cameraZoomRange={CAMERA_ZOOM_RANGE}
                showsUserLocation={showLocation}
                userInterfaceStyle="light"
            >
                <TerrainLayer terrain={map.terrain} />
                
                {map.controls.map((marker, index) => {
                    const isVisited = visitedIds.has(marker.id) || runStatus === 'completed';
                    const fill = isVisited ? 0 : fillProgressFor(index);
                    return (
                        <Marker
                            key={index}
                            coordinate={marker}
                            anchor={{x: 0.5, y: 0.5}}
                            onPress={() => canInspectControls && setSelectedControlIndex(index)}
                        >
                            {/* Yttre vyn ger plats åt skuggan */}
                            <View style={styles.markerWrapper}>
                                <View
                                    style={[
                                        styles.marker,
                                        isVisited && styles.markerVisited,
                                        selectedControlIndex === index && styles.markerSelected,
                                    ]}
                                >
                                    {/* Fylls nerifrån och upp medan man står vid kontrollen */}
                                    {fill > 0 && (
                                        <View style={styles.markerFillClip}>
                                            <View style={[styles.markerFill, { height: `${fill * 100}%` }]} />
                                        </View>
                                    )}
                                    <Text style={[styles.markerNumber, isVisited && styles.markerNumberVisited]}>
                                        {index + 1}
                                    </Text>
                                </View>
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
                    {/* Kompassen syns alltid. Tryck för att vrida tillbaka kartan mot norr. */}
                    <TouchableOpacity
                        style={styles.compass}
                        onPress={resetToNorth}
                        accessibilityRole="button"
                        accessibilityLabel="Kompass, vrid kartan mot norr"
                    >
                        <Animated.View style={[styles.compassRose, { transform: [{ rotate: compassRotation }] }]}>
                            <Text style={styles.compassNorth}>N</Text>
                            {/* Små streck för öster, söder och väster */}
                            <View style={[styles.compassTick, styles.compassTickEast]} />
                            <View style={[styles.compassTick, styles.compassTickSouth]} />
                            <View style={[styles.compassTick, styles.compassTickWest]} />
                            {/* Nålen: färgad halva pekar mot norr, grå mot söder */}
                            <View style={styles.compassNeedle}>
                                <View style={styles.needleNorth} />
                                <View style={styles.needleSouth} />
                            </View>
                        </Animated.View>
                    </TouchableOpacity>
                </View>

                {/* Info om kontrollen man tryckt på – ligger ovanför panelen och följer med den */}
                {selectedInfo && (
                    <Animated.View
                        style={[styles.controlInfoCard, { bottom: cardHeight + 12, transform: [{ translateY }] }]}
                        onLayout={(e) => setInfoCardHeight(e.nativeEvent.layout.height)}
                    >
                        <View style={styles.controlInfoText}>
                            <Text style={styles.controlInfoName} numberOfLines={1}>{selectedInfo.name}</Text>
                            {selectedInfo.subtitle && <Text style={styles.controlInfoSubtitle}>{selectedInfo.subtitle}</Text>}
                        </View>
                        <Text style={[styles.controlInfoStatus, !selectedInfo.isTaken && styles.controlInfoStatusNotTaken]}>
                            {selectedInfo.status}
                        </Text>
                        <TouchableOpacity onPress={() => setSelectedControlIndex(null)} hitSlop={12} accessibilityLabel="Stäng">
                            <Feather name="x" size={20} color={Colors.light.textMuted} />
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Ligger strax ovanför panelen (och infon om en kontroll) och följer med när panelen dras */}
                <Animated.View
                    style={[
                        styles.locationButtonWrapper,
                        { bottom: cardHeight + 12 + (selectedInfo ? infoCardHeight + 10 : 0), transform: [{ translateY }] },
                    ]}
                >
                    <TouchableOpacity
                        style={[styles.locationButton, showLocation && styles.locationButtonActive]}
                        onPress={() => setShowLocation((prev) => !prev)}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: showLocation }}
                        accessibilityLabel="Visa min position"
                    >
                        <Feather name="navigation" size={18} color={showLocation ? '#FFF' : Colors.light.textMuted} />
                    </TouchableOpacity>
                </Animated.View>

                <Animated.View
                    style={[styles.bottomCard, { transform: [{ translateY }] }]}
                    onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
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

            {/* Popup när en kontroll har tagits */}
            <Modal visible={stampedPopup !== null} animationType="fade" transparent={true}>
                <View style={styles.stampPopupOverlay}>
                    {stampedPopup && (
                        <View style={styles.stampPopupCard}>
                            <Text style={styles.stampPopupName}>{getControlInfo(stampedPopup.index).name}</Text>
                            <Text style={styles.stampPopupTitle}>Kontroll {stampedPopup.index + 1} avklarad!</Text>
                            <Image source={BIG_CONTROL_ICON} style={styles.stampPopupIcon} />
                            <Text style={styles.stampPopupTime}>{formatMsToTime(stampedPopup.elapsedMs)}</Text>
                            <TouchableOpacity style={styles.stampPopupButton} onPress={() => setStampedPopup(null)}>
                                <Text style={styles.stampPopupButtonText}>Återgå</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>

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
                                {/* I den ordning kontrollerna togs, eftersom de kan tas i vilken ordning som helst */}
                                {resultOrder.map((controlIndex, i) => {
                                    const info = getControlInfo(controlIndex);
                                    // Sträcktid = tiden från förra tagna kontrollen (eller starten) hit
                                    const previousMs = i === 0 ? 0 : getControlInfo(resultOrder[i - 1]).elapsedMs;
                                    const splitMs = info.elapsedMs !== undefined && previousMs !== undefined
                                        ? info.elapsedMs - previousMs
                                        : undefined;

                                    return (
                                        <View key={controlIndex} style={styles.timelineItem}>
                                            <View style={styles.timelineLeft}>
                                                <View style={styles.timelineDot}>
                                                    <Feather name="check" size={14} color="#FFF" />
                                                </View>
                                                {i < resultOrder.length - 1 && <View style={styles.timelineLine} />}
                                            </View>
                                            <View style={styles.timelinePillContainer}>
                                                <View style={[styles.timelinePill, styles.timelinePillRow]}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.timelinePillText} numberOfLines={1}>{info.name}</Text>
                                                        {info.subtitle && <Text style={styles.timelinePillSubtext}>{info.subtitle}</Text>}
                                                    </View>
                                                    <View style={{ alignItems: 'flex-end' }}>
                                                        {/* Total tid vid kontrollen, eller "Tagen" för äldre lopp utan sparad tid */}
                                                        <Text style={styles.timelinePillTime}>{info.status}</Text>
                                                        {splitMs !== undefined && (
                                                            <Text style={styles.timelinePillSubtext}>+{formatMsToTime(splitMs)}</Text>
                                                        )}
                                                    </View>
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
    compass: {
        width: COMPASS_SIZE,
        height: COMPASS_SIZE,
        borderRadius: COMPASS_SIZE / 2,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    // Hela rosen vrids – allt inuti placeras inom en fyrkant lika stor som kompassen
    compassRose: { width: COMPASS_SIZE, height: COMPASS_SIZE, alignItems: 'center', justifyContent: 'center' },
    compassNorth: {
        position: 'absolute',
        top: 2,
        fontSize: 9,
        fontWeight: 'bold',
        color: Colors.light.accent,
    },
    compassTick: { position: 'absolute', backgroundColor: '#9A9A8E' },
    compassTickEast: { right: 3, width: 4, height: 1.5 },
    compassTickWest: { left: 3, width: 4, height: 1.5 },
    compassTickSouth: { bottom: 3, width: 1.5, height: 4 },
    compassNeedle: { alignItems: 'center', marginTop: 4 },
    // Trianglar ritas med kanter: en synlig nederkant och två genomskinliga sidokanter
    needleNorth: {
        width: 0,
        height: 0,
        borderLeftWidth: 4.5,
        borderRightWidth: 4.5,
        borderBottomWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: Colors.light.accent,
    },
    needleSouth: {
        width: 0,
        height: 0,
        borderLeftWidth: 4.5,
        borderRightWidth: 4.5,
        borderTopWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#C9CABF',
    },
    locationButtonWrapper: { position: 'absolute', left: 20 },
    locationButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderWidth: 1,
        borderColor: '#D1D3C4',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 3,
    },
    locationButtonActive: { backgroundColor: '#4A5D4E', borderColor: '#4A5D4E' },

    // Kontroller: ej tagen = vit med orange ring, tagen = helt orange med vit siffra
    markerWrapper: { padding: 5 },
    marker: {
        width: MARKER_SIZE,
        height: MARKER_SIZE,
        borderRadius: MARKER_SIZE / 2,
        borderWidth: 3,
        borderColor: CONTROL_ORANGE,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 4,
    },
    markerVisited: { backgroundColor: CONTROL_ORANGE },
    // Egen cirkel som klipper fyllnaden – overflow: 'hidden' på själva kontrollen skulle ta bort skuggan på iOS
    markerFillClip: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: MARKER_SIZE / 2,
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    // Halvgenomskinlig så att siffran syns medan den fylls; blir helt orange när kontrollen är tagen
    markerFill: { width: '100%', backgroundColor: 'rgba(255, 107, 0, 0.5)' },
    markerNumber: { fontSize: 15, fontWeight: 'bold', color: CONTROL_ORANGE },
    markerNumberVisited: { color: '#FFF' },
    markerSelected: { transform: [{ scale: 1.2 }], borderWidth: 4 },

    controlInfoCard: {
        position: 'absolute',
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FFF',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 6,
    },
    controlInfoText: { flex: 1 },
    controlInfoName: { fontSize: 18, fontWeight: 'bold', color: '#000' },
    controlInfoSubtitle: { fontSize: 13, color: '#555', marginTop: 2 },
    controlInfoStatus: { fontSize: 16, fontWeight: '600', color: '#000', fontVariant: ['tabular-nums'] },
    controlInfoStatusNotTaken: { color: Colors.light.textMuted, fontWeight: '500' },

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

    // Popupen när en kontroll har tagits
    stampPopupOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.3)', justifyContent: 'center', alignItems: 'center', padding: 40 },
    stampPopupCard: {
        width: '100%',
        backgroundColor: '#FFF',
        borderRadius: 16,
        paddingVertical: 28,
        paddingHorizontal: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 10,
    },
    stampPopupName: { fontSize: 26, color: '#000', marginBottom: 8, textAlign: 'center' },
    stampPopupTitle: { fontSize: 18, color: '#000', marginBottom: 24, textAlign: 'center' },
    stampPopupIcon: { width: 110, height: 110, resizeMode: 'contain', marginBottom: 24 },
    stampPopupTime: { fontSize: 22, color: '#000', marginBottom: 12, fontVariant: ['tabular-nums'] },
    stampPopupButton: { backgroundColor: '#4A5D4E', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 48 },
    stampPopupButtonText: { color: '#FFF', fontSize: 18 },

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
    timelinePillRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    timelinePillTime: { fontSize: 16, fontWeight: 'bold', color: '#000', fontVariant: ['tabular-nums'] },
    timelinePillSubtext: { fontSize: 12, color: '#666', marginTop: 2, fontVariant: ['tabular-nums'] },
});
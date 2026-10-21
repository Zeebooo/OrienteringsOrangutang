import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { deleteMap, fetchMapsByOwner, updateMapInfo } from '@/services/mapsDAL';
import { fetchProfile, updateProfile } from '@/services/profilesDAL';
import { fetchUserRuns, RunSummary } from '@/services/runsDAL';
import type { Difficulty, OMap } from '@/types';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Lätt',
  medium: 'Medelsvår',
  hard: 'Svår',
};

const { width } = Dimensions.get('window');

// --- NIVÅER OCH TITLAR ---
const TITLES = [
    "KompassKramare", 
    "GPS krigare", 
    "StenSnubblare", 
    "Stigfinnare", 
    "KontrollJägare", 
    "KordinatKrigare", 
    "TerrängNinja", 
    "VädersträcksVäktare", 
    "OrienteringsOrakel", 
    "OrienteringsOrangutang"
];

function calculateProgress(total: number, step: number) {
    let level = Math.floor(total / step) + 1;
    
    if (level >= 10) {
        return { level: 10, current: 10 * step, max: 10 * step, progressPct: 100, isMax: true };
    }

    // Texten visar totalen gentemot nästa milstolpe (t.ex. 15 / 20)
    const currentTotal = total;
    const nextMilestone = level * step;

    // Baren mäter progressen ENBART inom det nuvarande intervallet (t.ex. mellan 10 och 20)
    const previousMilestone = (level - 1) * step;
    const progressInCurrentLevel = total - previousMilestone;
    const progressPct = Math.min(100, (progressInCurrentLevel / step) * 100);

    return {
        level: level,
        current: currentTotal,
        max: nextMilestone,
        progressPct: progressPct,
        isMax: false
    };
}

function getLevelStyle(level: number) {
    if (level <= 2) return { color: '#CD7F32', iconName: 'map-marker-outline' }; // Brons
    if (level <= 4) return { color: '#A9A9A9', iconName: 'map-outline' }; // Silver
    if (level <= 8) return { color: '#E6B800', iconName: 'map-marker-star' }; // Guld
    return { color: '#8A2BE2', iconName: 'treasure-chest' }; // Lila (Max)
}

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  
  // Statistik-states från databasen
  const [mapsCompleted, setMapsCompleted] = useState(0);
  const [controlsTaken, setControlsTaken] = useState(0);
  const [kmWalked, setKmWalked] = useState(0);
  
  const [showNameModal, setShowNameModal] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [myMaps, setMyMaps] = useState<OMap[]>([]);

  const [editingMap, setEditingMap] = useState<OMap | null>(null);
  const [editMapName, setEditMapName] = useState('');
  const [editMapDescription, setEditMapDescription] = useState('');
  const [editMapIsPrivate, setEditMapIsPrivate] = useState(false);
  const [savingMap, setSavingMap] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingMap, setDeletingMap] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadProfileData() {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user && isActive) {
            setUserId(user.id);
            
            const [profileData, runsData, mapsData] = await Promise.all([
              fetchProfile(user.id),
              fetchUserRuns(user.id),
              fetchMapsByOwner(user.id)
            ]);

            if (profileData && isActive) {
              setName(profileData.name || 'Okänd löpare');
              setMapsCompleted(profileData.maps_completed || 0);
              setControlsTaken(profileData.controls_taken || 0);
              setKmWalked(profileData.km_walked || 0);
            }
            
            if (runsData && isActive) {
              setRuns(runsData);
            }

            if (mapsData && isActive) {
              setMyMaps(mapsData);
            }
          }
        } catch (error) {
          console.error('Fel vid hämtning av profildata:', error);
        } finally {
          if (isActive) setLoading(false);
        }
      }

      loadProfileData();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const handleSaveName = async () => {
    const trimmedName = editNameInput.trim();
    if (trimmedName.length < 1 || trimmedName.length > 25 || !userId) return;

    setSavingName(true);
    try {
      const updatedProfile = await updateProfile(userId, trimmedName);
      if (updatedProfile) {
        setName(trimmedName);
        setShowNameModal(false);
      }
    } catch (error) {
      console.error('Kunde inte uppdatera namnet:', error);
    } finally {
      setSavingName(false);
    }
  };

  const openMapEditor = (map: OMap) => {
    setEditingMap(map);
    setEditMapName(map.name);
    setEditMapDescription(map.description);
    setEditMapIsPrivate(map.isPrivate);
    setMapError(null);
    setConfirmDelete(false);
  };

  const handleDeleteMap = async () => {
    if (!editingMap) return;

    setDeletingMap(true);
    setMapError(null);
    try {
      await deleteMap(editingMap.id);
      setMyMaps((prev) => prev.filter((m) => m.id !== editingMap.id));
      setEditingMap(null);
    } catch (error) {
      setMapError((error as Error).message);
      setConfirmDelete(false);
    } finally {
      setDeletingMap(false);
    }
  };

  const handleSaveMap = async () => {
    const trimmedName = editMapName.trim();
    if (!editingMap || trimmedName.length < 1) return;

    setSavingMap(true);
    setMapError(null);
    try {
      const updated = await updateMapInfo(editingMap.id, {
        name: trimmedName,
        description: editMapDescription.trim(),
        isPrivate: editMapIsPrivate,
      });
      setMyMaps((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMap(null);
    } catch (error) {
      setMapError((error as Error).message);
    } finally {
      setSavingMap(false);
    }
  };

  // --- BERÄKNING AV FRAMSTEG ---
  const mapsProg = calculateProgress(mapsCompleted, 10);
  const controlsProg = calculateProgress(controlsTaken, 50);
  const kmProg = calculateProgress(kmWalked, 30);

  // Global nivå = den lägsta av de tre
  const globalLevel = Math.min(mapsProg.level, controlsProg.level, kmProg.level);
  const globalTitle = TITLES[globalLevel - 1];

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        
        <View style={styles.headerContainer}>
          <View style={styles.headerTopIcons}>
            <TouchableOpacity>
              <Feather name="bell" size={24} color={Colors.light.textMain} />
            </TouchableOpacity>
            <TouchableOpacity>
              <Feather name="settings" size={24} color={Colors.light.textMain} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileImageWrapper}>
          <View style={styles.profileImageContainer}>
            <Feather name="user" size={50} color={Colors.light.textMuted} />
          </View>
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.nameText}>{name}</Text>
          <TouchableOpacity
            style={styles.editNameButton}
            onPress={() => { setEditNameInput(name); setShowNameModal(true); }}
            hitSlop={12}
          >
            <Feather name="edit-2" size={18} color={Colors.light.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.levelText}>{globalTitle} • Nivå {globalLevel}</Text>

        {/* STATISTIK-RUTOR */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{mapsCompleted}</Text>
            <Text style={styles.statLabel}>Kartor</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{controlsTaken}</Text>
            <Text style={styles.statLabel}>Kontroller</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{kmWalked.toFixed(1).replace('.', ',')}</Text>
            <Text style={styles.statLabel}>Km gått</Text>
          </View>
        </View>

        {/* --- ACHIEVEMENTS SEKTION --- */}
        <Text style={styles.sectionTitle}>Utmärkelser & Nivåer</Text>
        <View style={styles.card}>
          
          {/* Kartor */}
          <View style={styles.achievementRow}>
            <View style={[styles.achIconWrapper, { backgroundColor: getLevelStyle(mapsProg.level).color + '20' }]}>
              <MaterialCommunityIcons name="map-outline" size={22} color={getLevelStyle(mapsProg.level).color} />
            </View>
            <View style={styles.achContent}>
              <View style={styles.achHeaderRow}>
                <Text style={styles.achTitle}>Avklarade kartor</Text>
                <Text style={[styles.achLevelText, { color: getLevelStyle(mapsProg.level).color }]}>Nivå {mapsProg.level}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${mapsProg.progressPct}%`, backgroundColor: getLevelStyle(mapsProg.level).color }]} />
              </View>
              <Text style={styles.achStats}>{mapsProg.current} / {mapsProg.max}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Kontroller */}
          <View style={styles.achievementRow}>
            <View style={[styles.achIconWrapper, { backgroundColor: getLevelStyle(controlsProg.level).color + '20' }]}>
              <MaterialCommunityIcons name="map-marker-outline" size={22} color={getLevelStyle(controlsProg.level).color} />
            </View>
            <View style={styles.achContent}>
              <View style={styles.achHeaderRow}>
                <Text style={styles.achTitle}>Tagna kontroller</Text>
                <Text style={[styles.achLevelText, { color: getLevelStyle(controlsProg.level).color }]}>Nivå {controlsProg.level}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${controlsProg.progressPct}%`, backgroundColor: getLevelStyle(controlsProg.level).color }]} />
              </View>
              <Text style={styles.achStats}>{controlsProg.current} / {controlsProg.max}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Kilometer */}
          <View style={styles.achievementRow}>
            <View style={[styles.achIconWrapper, { backgroundColor: getLevelStyle(kmProg.level).color + '20' }]}>
              <MaterialCommunityIcons name="shoe-print" size={22} color={getLevelStyle(kmProg.level).color} />
            </View>
            <View style={styles.achContent}>
              <View style={styles.achHeaderRow}>
                <Text style={styles.achTitle}>Avverkade kilometer</Text>
                <Text style={[styles.achLevelText, { color: getLevelStyle(kmProg.level).color }]}>Nivå {kmProg.level}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${kmProg.progressPct}%`, backgroundColor: getLevelStyle(kmProg.level).color }]} />
              </View>
              <Text style={styles.achStats}>{typeof kmProg.current === 'number' ? kmProg.current.toFixed(1).replace('.', ',') : kmProg.current} / {kmProg.max}</Text>
            </View>
          </View>

        </View>

        <Text style={styles.sectionTitle}>Mina kartor</Text>
        <View style={styles.card}>
          {myMaps.length === 0 && (
            <Text style={styles.emptyMapsText}>Du har inte skapat några kartor än</Text>
          )}

          {myMaps.map((map, index) => (
            <View key={map.id}>
              <TouchableOpacity style={styles.menuRow} onPress={() => router.push(`/map?id=${map.id}`)}>
                <View style={styles.rowLeft}>
                  <View style={styles.iconWrapper}>
                    <Feather name="map-pin" size={18} color={Colors.light.accent} />
                  </View>
                  <View>
                    <Text style={styles.menuText}>{map.name}</Text>
                    <Text style={styles.mapInfoText}>
                      {map.distanceM !== null && `${(map.distanceM / 1000).toFixed(1).replace('.', ',')} km · `}
                      {map.controls.length} kontroller · {DIFFICULTY_LABELS[map.difficulty]}
                      {map.isPrivate && ' · Privat'}
                    </Text>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  <TouchableOpacity
                    onPress={() => openMapEditor(map)}
                    hitSlop={12}
                  >
                    <Feather name="edit-2" size={18} color={Colors.light.textMuted} />
                  </TouchableOpacity>
                  <Feather name="chevron-right" size={20} color={Colors.light.textMuted} />
                </View>
              </TouchableOpacity>
              {index < myMaps.length - 1 && <View style={styles.separator} />}
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logga ut</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Modal för namnbyte */}
      <Modal visible={showNameModal} animationType="fade" transparent={true}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ändra namn</Text>
            <TextInput
              style={styles.input}
              value={editNameInput}
              onChangeText={setEditNameInput}
              autoFocus={true}
              maxLength={25}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowNameModal(false)}>
                <Text style={styles.cancelButtonText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, !editNameInput.trim() && styles.saveButtonDisabled]} onPress={handleSaveName} disabled={!editNameInput.trim() || savingName}>
                {savingName ? <ActivityIndicator color={Colors.light.background} /> : <Text style={styles.saveButtonText}>Spara</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal för kartredigering */}
      <Modal visible={editingMap !== null} animationType="fade" transparent={true}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ändra karta</Text>
            <Text style={styles.inputLabel}>Kartans namn</Text>
            <TextInput style={styles.input} value={editMapName} onChangeText={setEditMapName} maxLength={40} />
            <Text style={styles.inputLabel}>Beskrivning</Text>
            <TextInput style={[styles.input, styles.multilineInput]} value={editMapDescription} onChangeText={setEditMapDescription} multiline />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingMap(null)}>
                <Text style={styles.cancelButtonText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, !editMapName.trim() && styles.saveButtonDisabled]} onPress={handleSaveMap} disabled={!editMapName.trim() || savingMap}>
                {savingMap ? <ActivityIndicator color={Colors.light.background} /> : <Text style={styles.saveButtonText}>Spara</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.cardBg },
  container: { flex: 1, backgroundColor: Colors.light.beigeBgDarker },
  contentContainer: { paddingBottom: 40 },
  headerContainer: { backgroundColor: Colors.light.cardBg, height: 140, borderBottomLeftRadius: width, borderBottomRightRadius: width, transform: [{ scaleX: 1.2 }], alignItems: 'center', paddingTop: 20 },
  headerTopIcons: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 40, transform: [{ scaleX: 1 / 1.2 }] },
  profileImageWrapper: { alignSelf: 'center', marginTop: -55, zIndex: 10, backgroundColor: Colors.light.beigeBgDarker, borderRadius: 70, padding: 6 },
  profileImageContainer: { width: 100, height: 100, backgroundColor: Colors.light.border, borderRadius: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.light.accent },
  nameRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  nameText: { textAlign: 'center', fontSize: 24, fontWeight: 'bold', color: Colors.light.textMain },
  editNameButton: { marginLeft: 8 },
  levelText: { textAlign: 'center', fontSize: 14, color: Colors.light.accent, fontWeight: '600', marginTop: 4, marginBottom: 20 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-evenly', backgroundColor: Colors.light.cardBg, marginHorizontal: 20, paddingVertical: 15, borderRadius: 12, marginBottom: 25 },
  statBox: { alignItems: 'center', flex: 1 },
  statDivider: { width: 1, backgroundColor: Colors.light.border, marginVertical: 5 },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: Colors.light.textMain },
  statLabel: { fontSize: 12, color: Colors.light.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: Colors.light.textMuted, marginLeft: 25, marginBottom: 8, textTransform: 'uppercase' },
  card: { backgroundColor: Colors.light.cardBg, marginHorizontal: 20, borderRadius: 12, marginBottom: 25, paddingHorizontal: 15 },
  
  achievementRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  achIconWrapper: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  achContent: { flex: 1 },
  achHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  achTitle: { fontSize: 15, fontWeight: '600', color: Colors.light.textMain },
  achLevelText: { fontSize: 13, fontWeight: 'bold' },
  progressTrack: { height: 8, backgroundColor: '#EAEAE2', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 4 },
  achStats: { fontSize: 11, color: Colors.light.textMuted, textAlign: 'right', fontVariant: ['tabular-nums'] },

  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15 },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconWrapper: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.light.beigeBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuText: { color: Colors.light.textMain, fontSize: 16, fontWeight: '500' },
  emptyMapsText: { color: Colors.light.textMuted, fontSize: 15, textAlign: 'center', paddingVertical: 16 },
  mapInfoText: { color: Colors.light.textMuted, fontSize: 13, marginTop: 2 },
  separator: { height: 1, backgroundColor: Colors.light.border, marginLeft: 44 },
  logoutButton: { marginHorizontal: 20, paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  logoutText: { color: Colors.light.danger, fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.light.cardBg, width: '100%', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.light.textMain, marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: Colors.light.beigeBg, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 12, padding: 16, fontSize: 16, color: Colors.light.textMain, marginBottom: 24 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: Colors.light.textMain, marginBottom: 8 },
  multilineInput: { minHeight: 100, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.light.beigeBg },
  cancelButtonText: { color: Colors.light.textMain, fontSize: 16, fontWeight: '600' },
  saveButton: { flex: 1, backgroundColor: Colors.light.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: Colors.light.textMuted },
  saveButtonText: { color: Colors.light.background, fontSize: 16, fontWeight: 'bold' },
});
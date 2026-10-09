import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView, StyleSheet, Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { deleteMap, fetchMapsByOwner, updateMapInfo } from '@/services/mapsDAL';
import { fetchProfile, updateProfile } from '@/services/profilesDAL';
import { fetchUserRuns, RunSummary } from '@/services/runsDAL';
import type { Difficulty, OMap } from '@/types';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Lätt',
  medium: 'Medelsvår',
  hard: 'Svår',
};

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // Profil-state
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  
  // State för att ändra namn
  const [showNameModal, setShowNameModal] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Historik-state
  const [runs, setRuns] = useState<RunSummary[]>([]);

  // Kartor som användaren själv har skapat
  const [myMaps, setMyMaps] = useState<OMap[]>([]);

  // State för att ändra namn och beskrivning på en egen karta
  const [editingMap, setEditingMap] = useState<OMap | null>(null);
  const [editMapName, setEditMapName] = useState('');
  const [editMapDescription, setEditMapDescription] = useState('');
  const [editMapIsPrivate, setEditMapIsPrivate] = useState(false);
  const [savingMap, setSavingMap] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  // Första trycket på "Ta bort" visar en bekräftelse, andra trycket tar bort
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingMap, setDeletingMap] = useState(false);

  // Hämtas varje gång profilfliken visas, så att en nyss skapad karta syns direkt
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      fetchMapsByOwner(userId)
        .then(setMyMaps)
        .catch((error) => console.error('Kunde inte hämta mina kartor:', error));
    }, [userId]),
  );

  useEffect(() => {
    async function loadProfileData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUserId(user.id);
          
          const [profileData, runsData] = await Promise.all([
            fetchProfile(user.id),
            fetchUserRuns(user.id)
          ]);

          if (profileData) {
            setName(profileData.name || 'Okänd löpare');
          }
          
          if (runsData) {
            setRuns(runsData);
          }
        }
      } catch (error) {
        console.error('Fel vid hämtning av profildata:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProfileData();
  }, []);

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
      // Byt ut kartan i listan så att ändringen syns direkt
      setMyMaps((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMap(null);
    } catch (error) {
      setMapError((error as Error).message);
    } finally {
      setSavingMap(false);
    }
  };

  // Beräkna dynamisk statistik baserat på databasen
  const totalMapsCount = new Set(runs.map(r => r.mapId)).size; // Antal unika banor man provat
  const totalControlsVisited = runs.reduce((acc, run) => acc + run.visitedControls.length, 0); // Totala kontroller

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
            accessibilityLabel="Ändra namn"
          >
            <Feather name="edit-2" size={18} color={Colors.light.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.levelText}>Stigfinnare • Nivå 4</Text>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalMapsCount}</Text>
            <Text style={styles.statLabel}>Kartor</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalControlsVisited}</Text>
            <Text style={styles.statLabel}>Kontroller</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            {/* Hårdkodad distans för nu, då ni inte sparar distans i Runs-tabellen */}
            <Text style={styles.statNumber}>34</Text>
            <Text style={styles.statLabel}>Km gått</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Min orientering</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.menuRow}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapper}>
                <Feather name="map" size={18} color={Colors.light.accent} />
              </View>
              <Text style={styles.menuText}>Min historik</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.light.textMuted} />
          </TouchableOpacity>
          
          <View style={styles.separator} />

          <TouchableOpacity style={styles.menuRow}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapper}>
                <Feather name="award" size={18} color={Colors.light.accent} />
              </View>
              <Text style={styles.menuText}>Utmärkelser & Badges</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.light.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Mina kartor</Text>
        <View style={styles.card}>
          {myMaps.map((map) => (
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
                    accessibilityLabel={`Ändra ${map.name}`}
                  >
                    <Feather name="edit-2" size={18} color={Colors.light.textMuted} />
                  </TouchableOpacity>
                  <Feather name="chevron-right" size={20} color={Colors.light.textMuted} />
                </View>
              </TouchableOpacity>
              <View style={styles.separator} />
            </View>
          ))}

          <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/create')}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapper}>
                <Feather name="plus" size={18} color={Colors.light.accent} />
              </View>
              <Text style={styles.menuText}>
                {myMaps.length === 0 ? 'Skapa din första karta' : 'Skapa ny karta'}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.light.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logga ut</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Modal för att byta namn */}
      <Modal
        visible={showNameModal}
        animationType="fade"
        transparent={true}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
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
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowNameModal(false)}
              >
                <Text style={styles.cancelButtonText}>Avbryt</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.saveButton, !editNameInput.trim() && styles.saveButtonDisabled]} 
                onPress={handleSaveName}
                disabled={!editNameInput.trim() || savingName}
              >
                {savingName ? (
                  <ActivityIndicator color={Colors.light.background} />
                ) : (
                  <Text style={styles.saveButtonText}>Spara</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal för att ändra namn och beskrivning på en egen karta */}
      <Modal
        visible={editingMap !== null}
        animationType="fade"
        transparent={true}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ändra karta</Text>

            <Text style={styles.inputLabel}>Kartans namn</Text>
            <TextInput
              style={styles.input}
              value={editMapName}
              onChangeText={setEditMapName}
              maxLength={40}
            />

            <Text style={styles.inputLabel}>Beskrivning</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={editMapDescription}
              onChangeText={setEditMapDescription}
              placeholder="Fyll i en beskrivning för kartan"
              placeholderTextColor={Colors.light.textMuted}
              multiline
            />

            <Text style={styles.inputLabel}>Vem kan se kartan?</Text>
            <View style={styles.visibilityRow}>
              {[
                { value: true, label: 'Bara jag', icon: 'lock' as const },
                { value: false, label: 'Alla', icon: 'globe' as const },
              ].map((option) => {
                const active = editMapIsPrivate === option.value;
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[styles.visibilityOption, active && styles.visibilityOptionActive]}
                    onPress={() => setEditMapIsPrivate(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Feather name={option.icon} size={16} color={active ? Colors.light.background : Colors.light.textMain} />
                    <Text style={[styles.visibilityText, active && styles.visibilityTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {mapError && <Text style={styles.errorText}>{mapError}</Text>}

            {confirmDelete ? (
              <>
                <Text style={styles.confirmText}>
                  {`Vill du ta bort ”${editingMap?.name}”? Kartan och alla lopp på den försvinner för alla. Det går inte att ångra.`}
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setConfirmDelete(false)}>
                    <Text style={styles.cancelButtonText}>Avbryt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteMap} disabled={deletingMap}>
                    {deletingMap ? (
                      <ActivityIndicator color={Colors.light.background} />
                    ) : (
                      <Text style={styles.saveButtonText}>Ta bort</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setEditingMap(null)}
                  >
                    <Text style={styles.cancelButtonText}>Avbryt</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveButton, !editMapName.trim() && styles.saveButtonDisabled]}
                    onPress={handleSaveMap}
                    disabled={!editMapName.trim() || savingMap}
                  >
                    {savingMap ? (
                      <ActivityIndicator color={Colors.light.background} />
                    ) : (
                      <Text style={styles.saveButtonText}>Spara</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.deleteLink} onPress={() => setConfirmDelete(true)}>
                  <Feather name="trash-2" size={16} color={Colors.light.danger} />
                  <Text style={styles.deleteLinkText}>Ta bort karta</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.cardBg, 
  },
  container: {
    flex: 1,
    backgroundColor: Colors.light.beigeBgDarker, 
  },
  contentContainer: {
    paddingBottom: 40,
  },
  headerContainer: {
    backgroundColor: Colors.light.cardBg,
    height: 140,
    borderBottomLeftRadius: width,
    borderBottomRightRadius: width,
    transform: [{ scaleX: 1.2 }],
    alignItems: 'center',
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  headerTopIcons: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40, 
    transform: [{ scaleX: 1 / 1.2 }], 
  },
  profileImageWrapper: {
    alignSelf: 'center',
    marginTop: -55, 
    zIndex: 10,
    backgroundColor: Colors.light.beigeBgDarker,
    borderRadius: 70,
    padding: 6, 
  },
  profileImageContainer: {
    width: 100,
    height: 100,
    backgroundColor: Colors.light.border,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.accent, 
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  nameText: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.textMain,
  },
  editNameButton: {
    marginLeft: 8,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textMain,
    marginBottom: 8,
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: Colors.light.danger,
    marginBottom: 16,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.beigeBg,
  },
  visibilityOptionActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  visibilityText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.textMain,
  },
  visibilityTextActive: {
    color: Colors.light.background,
  },
  confirmText: {
    fontSize: 15,
    color: Colors.light.textMain,
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: Colors.light.danger,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  deleteLinkText: {
    color: Colors.light.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  levelText: {
    textAlign: 'center',
    fontSize: 14,
    color: Colors.light.accent,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    backgroundColor: Colors.light.cardBg,
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 5,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.textMain,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textMuted,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textMuted,
    marginLeft: 25,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: Colors.light.cardBg,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 25,
    paddingHorizontal: 15,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.beigeBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    color: Colors.light.textMain,
    fontSize: 16,
    fontWeight: '500',
  },
  mapInfoText: {
    color: Colors.light.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginLeft: 44, 
  },
  logoutButton: {
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutText: {
    color: Colors.light.danger, 
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Styling för Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.light.cardBg, width: '100%', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.light.textMain, marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: Colors.light.beigeBg, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 12, padding: 16, fontSize: 16, color: Colors.light.textMain, marginBottom: 24 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.light.beigeBg },
  cancelButtonText: { color: Colors.light.textMain, fontSize: 16, fontWeight: '600' },
  saveButton: { flex: 1, backgroundColor: Colors.light.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: Colors.light.textMuted },
  saveButtonText: { color: Colors.light.background, fontSize: 16, fontWeight: 'bold' },
});
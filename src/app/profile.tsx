import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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
import { fetchProfile, updateProfile } from '@/services/profilesDAL';
import { fetchUserRuns, RunSummary } from '@/services/runsDAL';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
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

        <Text style={styles.nameText}>{name}</Text>
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

        <Text style={styles.sectionTitle}>Inställningar</Text>
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.menuRow} 
            onPress={() => { setEditNameInput(name); setShowNameModal(true); }}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapper}>
                <Feather name="edit-3" size={18} color={Colors.light.textMuted} />
              </View>
              <Text style={styles.menuText}>Ändra profilinformation</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.light.textMuted} />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.menuRow}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapper}>
                <Feather name="globe" size={18} color={Colors.light.textMuted} />
              </View>
              <Text style={styles.menuText}>Språk</Text>
            </View>
            <Text style={styles.actionText}>Svenska</Text>
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
  nameText: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    color: Colors.light.textMain,
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
  actionText: {
    color: Colors.light.textMuted,
    fontSize: 16,
    fontWeight: '500',
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
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { fetchMaps, MapWithState } from '@/services/mapsDAL';
import { fetchProfile, updateProfile } from '@/services/profilesDAL';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type TabType = 'Nya' | 'Påbörjade' | 'Avklarade';

export default function MapListScreen() {
  const router = useRouter();
  
  const [maps, setMaps] = useState<MapWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('Nya');
  
  // Namn-modal states
  const [showNameModal, setShowNameModal] = useState(false);
  const [userNameInput, setUserNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const profile = await fetchProfile(user.id);
          if (!profile?.name) {
            setShowNameModal(true);
          }
          const fetchedMaps = await fetchMaps(user.id);
          setMaps(fetchedMaps);
        }
      } catch (error) {
        console.error('Fel vid laddning av data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSaveName = async () => {
    const trimmedName = userNameInput.trim();
    if (trimmedName.length < 1 || trimmedName.length > 25) return; 

    setSavingName(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await updateProfile(user.id, trimmedName);
        setShowNameModal(false);
      }
    } catch (error) {
      console.error('Kunde inte spara namnet:', error);
    } finally {
      setSavingName(false);
    }
  };

  // Filtrera kartorna baserat på vald flik
  const filteredMaps = maps.filter(map => {
    if (activeTab === 'Nya') return map.state === 'not_started';
    if (activeTab === 'Påbörjade') return map.state === 'started';
    if (activeTab === 'Avklarade') return map.state === 'completed';
    return true;
  });

  // Hjälpfunktion för att översätta och rita svårighetsgraden som i Figma
  const renderDifficulty = (difficulty: string) => {
    let diffText = 'Okänd';
    let filledDots = 1;

    switch(difficulty.toLowerCase()) {
      case 'easy': diffText = 'Lätt'; filledDots = 1; break;
      case 'medium': diffText = 'Medelsvår'; filledDots = 2; break;
      case 'hard': diffText = 'Svår'; filledDots = 3; break;
    }

    return (
      <View style={styles.difficultyContainer}>
        <Text style={styles.cardInfoText}>{diffText}</Text>
        <View style={styles.dotsContainer}>
          {[1, 2, 3].map((dot) => (
            <View 
              key={dot} 
              style={[
                styles.dot, 
                dot <= filledDots ? styles.dotFilled : styles.dotEmpty
              ]} 
            />
          ))}
        </View>
      </View>
    );
  };

  const renderMapItem = ({ item }: { item: MapWithState }) => {
    // Formatera avstånd som "5,2 km"
    const distanceDisplay = item.distanceM 
      ? `${(item.distanceM / 1000).toFixed(1).replace('.', ',')} km` 
      : 'Okänd längd';

    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push(`/map?id=${item.id}`)}
      >
        <View style={styles.cardContent}>
          {/* Platshållare för kartbilden (eftersom vi saknar bilder i DB än) */}
          <View style={styles.imagePlaceholder}>
            <Feather name="map" size={24} color={Colors.light.accent} />
          </View>

          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardInfoText} numberOfLines={1}>{item.description}</Text>
            <Text style={styles.cardInfoText}>{distanceDisplay}</Text>
            {renderDifficulty(item.difficulty)}
          </View>
          
          <Feather name="chevron-right" size={24} color={Colors.light.textMain} style={styles.chevronIcon} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIcon}>
            <Feather name="menu" size={28} color={Colors.light.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kartor</Text>
          <TouchableOpacity style={styles.headerIcon}>
            <Feather name="search" size={28} color={Colors.light.textMain} />
          </TouchableOpacity>
        </View>

        {/* Flikar (Tabs) */}
        <View style={styles.tabContainer}>
          {(['Nya', 'Påbörjade', 'Avklarade'] as TabType[]).map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lista */}
        {filteredMaps.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Inga kartor här än.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredMaps}
            keyExtractor={(item) => item.id}
            renderItem={renderMapItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Namn Onboarding Modal (samma som tidigare) */}
        <Modal visible={showNameModal} animationType="fade" transparent={true}>
          <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Välkommen!</Text>
              <Text style={styles.modalDesc}>Vad vill du kallas i appen?</Text>
              <TextInput
                style={styles.input}
                placeholder="Skriv ditt namn här..."
                placeholderTextColor={Colors.light.textMuted}
                value={userNameInput}
                onChangeText={setUserNameInput}
                autoFocus={true}
                maxLength={25}
              />
              <TouchableOpacity 
                style={[styles.saveButton, !userNameInput.trim() && styles.saveButtonDisabled]} 
                onPress={handleSaveName}
                disabled={!userNameInput.trim() || savingName}
              >
                {savingName ? <ActivityIndicator color={Colors.light.background} /> : <Text style={styles.saveButtonText}>Spara och fortsätt</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5EC', // Ljusbeige bakgrund från designen
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5EC',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerIcon: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },

  // Flikar
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#D3D3D3', // Tunn grå linje under hela flikraden
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#000', // Svart indikator under aktiv flik
  },
  tabText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#000',
    fontWeight: 'bold',
  },

  // Lista & Kort
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imagePlaceholder: {
    width: 70,
    height: 70,
    backgroundColor: '#E5E8DD', // Grönaktig platshållarfärg
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  cardInfoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  chevronIcon: {
    marginLeft: 10,
  },

  // Svårighetsgrad (Prickar)
  difficultyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginLeft: 6,
    gap: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D38E5A', // Orangeaktig kantfärg
  },
  dotFilled: {
    backgroundColor: '#D38E5A', // Orangeaktig fyllnad
  },
  dotEmpty: {
    backgroundColor: 'transparent',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    fontStyle: 'italic',
  },

  // Modal (oförändrad)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', width: '100%', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#000', marginBottom: 8, textAlign: 'center' },
  modalDesc: { fontSize: 16, color: '#666', marginBottom: 24, textAlign: 'center' },
  input: { backgroundColor: '#F5F5EC', borderWidth: 1, borderColor: '#DDD', borderRadius: 12, padding: 16, fontSize: 16, color: '#000', marginBottom: 24 },
  saveButton: { backgroundColor: Colors.light.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#CCC' },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
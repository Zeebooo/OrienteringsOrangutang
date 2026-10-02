import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { fetchMaps, MapWithState } from '@/services/mapsDAL';
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
// Importera funktionerna från din kompis fil
import { fetchProfile, updateProfile } from '@/services/profilesDAL';

export default function MapListScreen() {
  const router = useRouter();
  
  const [maps, setMaps] = useState<MapWithState[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showNameModal, setShowNameModal] = useState(false);
  const [userNameInput, setUserNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Använd DAL-funktionen för att hämta profilen
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
        // Använd DAL-funktion för att uppdatera
        await updateProfile(user.id, trimmedName);
        setShowNameModal(false);
      }
    } catch (error) {
      console.error('Kunde inte spara namnet:', error);
    } finally {
      setSavingName(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Laddar...</Text>
      </View>
    );
  }

  const renderMapItem = ({ item }: { item: MapWithState }) => {
    let statusIcon = 'circle';
    let statusColor: string = Colors.light.textMuted;
    
    if (item.state === 'completed') {
      statusIcon = 'check-circle';
      statusColor = Colors.light.accent;
    } else if (item.state === 'started') {
      statusIcon = 'play-circle';
      statusColor = Colors.light.primary;
    }

    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push(`/map?id=${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Feather name={statusIcon as any} size={24} color={statusColor} />
        </View>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        
        <View style={styles.tagsContainer}>
          <View style={styles.tag}>
            <Feather name="map" size={12} color={Colors.light.textMuted} style={styles.tagIcon} />
            <Text style={styles.tagText}>
              {item.distanceM ? `${(item.distanceM / 1000).toFixed(1)} km` : 'Okänd'}
            </Text>
          </View>
          <View style={styles.tag}>
            <Feather name="bar-chart-2" size={12} color={Colors.light.textMuted} style={styles.tagIcon} />
            <Text style={styles.tagText}>{item.difficulty}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Välj karta</Text>
      
      {maps.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Inga kartor hittades.</Text>
        </View>
      ) : (
        <FlatList
          data={maps}
          keyExtractor={(item) => item.id}
          renderItem={renderMapItem}
          contentContainerStyle={styles.listContent}
        />
      )}

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
            <Text style={styles.modalTitle}>Välkommen!</Text>
            <Text style={styles.modalDesc}>Vad vill du kallas i appen?</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Skriv ditt namn här..."
              placeholderTextColor={Colors.light.textMuted}
              value={userNameInput}
              onChangeText={setUserNameInput}
              autoFocus={true}
              maxLength={25} // Matchar valideringen i profilesDAL.tsx
            />

            <TouchableOpacity 
              style={[styles.saveButton, !userNameInput.trim() && styles.saveButtonDisabled]} 
              onPress={handleSaveName}
              disabled={!userNameInput.trim() || savingName}
            >
              {savingName ? (
                <ActivityIndicator color={Colors.light.background} />
              ) : (
                <Text style={styles.saveButtonText}>Spara och fortsätt</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.beigeBgDarker },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: Colors.light.textMuted, fontSize: 16 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: Colors.light.textMain, marginTop: 60, marginBottom: 20, paddingHorizontal: 20 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: Colors.light.cardBg, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.light.textMain },
  cardDesc: { fontSize: 14, color: Colors.light.textMuted, marginBottom: 16 },
  tagsContainer: { flexDirection: 'row', gap: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.light.beigeBg, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: Colors.light.border },
  tagIcon: { marginRight: 4 },
  tagText: { fontSize: 12, fontWeight: '600', color: Colors.light.textMain },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.light.cardBg, width: '100%', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.light.textMain, marginBottom: 8, textAlign: 'center' },
  modalDesc: { fontSize: 16, color: Colors.light.textMuted, marginBottom: 24, textAlign: 'center' },
  input: { backgroundColor: Colors.light.beigeBg, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 12, padding: 16, fontSize: 16, color: Colors.light.textMain, marginBottom: 24 },
  saveButton: { backgroundColor: Colors.light.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: Colors.light.textMuted },
  saveButtonText: { color: Colors.light.background, fontSize: 16, fontWeight: 'bold' },
});
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react'; // 1. Importera useState
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Mock-data med en ny egenskap: "status"
const mapsData = [
  // NYA
  { id: '1', title: 'Tegsområdet', location: 'Umeå', distance: '5,2 km', difficulty: 'Medelsvår', diffLevel: 2, status: 'Nya' },
  { id: '2', title: 'Nydalasjön', location: 'Umeå', distance: '3,8 km', difficulty: 'Lätt', diffLevel: 1, status: 'Nya' },
  { id: '3', title: 'Tegsområdet', location: 'Umeå', distance: '3,8 km', difficulty: 'Medelsvår', diffLevel: 2, status: 'Nya' },
  { id: '4', title: 'Tegsområdet', location: 'Umeå', distance: '3,8 km', difficulty: 'Medelsvår', diffLevel: 2, status: 'Nya' },
  
  // PÅBÖRJADE
  { id: '5', title: 'Nydalasjön', location: 'Umeå', distance: '3,8 km', difficulty: 'Lätt', diffLevel: 1, status: 'Påbörjade' },
  
  // AVKLARADE
  { id: '6', title: 'Stadsskogen', location: 'Umeå', distance: '4,5 km', difficulty: 'Medelsvår', diffLevel: 2, status: 'Avklarade' },
];

export default function MapsScreen() {
  const router = useRouter();
  
  // 2. Skapa ett state som håller koll på vilken flik som är klickad. Standard är 'Nya'.
  const [activeTab, setActiveTab] = useState('Nya');

  // 3. Filtrera listan så att bara de kartor som har samma status som den aktiva fliken visas
  const displayedMaps = mapsData.filter(item => item.status === activeTab);

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Feather name="menu" size={28} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kartor</Text>
        <TouchableOpacity>
          <Feather name="search" size={28} color="black" />
        </TouchableOpacity>
      </View>

      {/* FLIKAR (Sub-navigation) */}
      <View style={styles.tabContainer}>
        {/* Flik: Nya */}
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Nya' && styles.activeTabButton]}
          onPress={() => setActiveTab('Nya')}
        >
          <Text style={[styles.tabText, activeTab === 'Nya' && styles.activeTabText]}>Nya</Text>
        </TouchableOpacity>
        
        {/* Flik: Påbörjade */}
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Påbörjade' && styles.activeTabButton]}
          onPress={() => setActiveTab('Påbörjade')}
        >
          <Text style={[styles.tabText, activeTab === 'Påbörjade' && styles.activeTabText]}>Påbörjade</Text>
        </TouchableOpacity>
        
        {/* Flik: Avklarade */}
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Avklarade' && styles.activeTabButton]}
          onPress={() => setActiveTab('Avklarade')}
        >
          <Text style={[styles.tabText, activeTab === 'Avklarade' && styles.activeTabText]}>Avklarade</Text>
        </TouchableOpacity>
      </View>

      {/* LISTA MED KARTOR */}
      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {/* 4. Vi loopar igenom 'displayedMaps' istället för hela 'mapsData' */}
        {displayedMaps.map((item) => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.card}
            onPress={() => {
              // Gör så att alla kartor går att klicka på för att testa informationsvyn
              router.push('/map'); 
            }}
          >
            
            {/* Bild-platshållare */}
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imageText}>Karta</Text>
            </View>

            {/* Information */}
            <View style={styles.infoContainer}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubText}>{item.location}</Text>
              <Text style={styles.cardSubText}>{item.distance}</Text>
              
              <View style={styles.difficultyContainer}>
                <Text style={styles.cardSubText}>{item.difficulty}</Text>
                <View style={styles.dotsRow}>
                  {[1, 2, 3].map((dot) => (
                    <View 
                      key={dot} 
                      style={[
                        styles.dot, 
                        dot <= item.diffLevel ? styles.dotFilled : styles.dotEmpty
                      ]} 
                    />
                  ))}
                </View>
              </View>
            </View>

            {/* Pil höger */}
            <View style={styles.chevronContainer}>
              <Feather name="chevron-right" size={24} color="black" />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F4EE', 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#DCDCDC',
    marginHorizontal: 20,
  },
  tabButton: {
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 16,
    color: '#757575',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    padding: 15,
    marginBottom: 15,
    borderRadius: 4,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: '#D6E5D0', 
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  imageText: {
    color: '#555',
    fontSize: 12,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
  },
  difficultyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  dotFilled: {
    backgroundColor: '#C87B4E', 
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C87B4E',
  },
  chevronContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 10,
  },
});
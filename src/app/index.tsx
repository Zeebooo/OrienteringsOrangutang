import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProgress } from '@/context/ProgressContext';
import { maps } from '@/data/maps';
import type { OMap } from '@/types';

function getDifficultyInfo(difficulty: string) {
  switch (difficulty) {
    case 'Easy': return { text: 'Lätt', level: 1 };
    case 'Medium': return { text: 'Medelsvår', level: 2 };
    case 'Hard': return { text: 'Svår', level: 3 };
    default: return { text: 'Okänd', level: 0 };
  }
}

export default function MapsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Nya');
  
  const { startedMaps, completedMaps } = useProgress();

  const uiMaps = maps.map((mapData: OMap) => {
    const diffInfo = getDifficultyInfo(mapData.difficulty);
    
    let currentStatus = 'Nya';
    if (completedMaps.includes(mapData.id)) {
      currentStatus = 'Avklarade';
    } else if (startedMaps.includes(mapData.id)) {
      currentStatus = 'Påbörjade';
    }
    
    return {
      id: mapData.id,
      title: mapData.name,
      location: 'Umeå', 
      distance: '4,0 km', 
      difficulty: diffInfo.text,
      diffLevel: diffInfo.level,
      status: currentStatus, 
    };
  });

  const displayedMaps = uiMaps.filter(item => item.status === activeTab);

  return (
    <SafeAreaView style={styles.safeArea}>
      
      <View style={styles.header}>
        <TouchableOpacity>
          <Feather name="menu" size={28} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kartor</Text>
        <TouchableOpacity>
          <Feather name="search" size={28} color="black" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Nya' && styles.activeTabButton]}
          onPress={() => setActiveTab('Nya')}
        >
          <Text style={[styles.tabText, activeTab === 'Nya' && styles.activeTabText]}>Nya</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Påbörjade' && styles.activeTabButton]}
          onPress={() => setActiveTab('Påbörjade')}
        >
          <Text style={[styles.tabText, activeTab === 'Påbörjade' && styles.activeTabText]}>Påbörjade</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Avklarade' && styles.activeTabButton]}
          onPress={() => setActiveTab('Avklarade')}
        >
          <Text style={[styles.tabText, activeTab === 'Avklarade' && styles.activeTabText]}>Avklarade</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {displayedMaps.map((item) => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.card}
            onPress={() => {
              router.push(`/map?id=${item.id}`); 
            }}
          >
            
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imageText}>Karta</Text>
            </View>

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
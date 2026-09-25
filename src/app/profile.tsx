import { Feather } from '@expo/vector-icons';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native'; // SafeAreaView är borttagen härifrån
import { SafeAreaView } from 'react-native-safe-area-context'; // Ny import här

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        
        {/* VITA TOPPEN MED KURVA */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTopIcons}>
            <Feather name="bell" size={28} color="black" />
            <Feather name="more-vertical" size={28} color="black" />
          </View>
        </View>

        {/* PROFILBILD  */}
        <View style={styles.profileImageContainer}>
          <Text style={styles.profileImageText}>Profilbild</Text>
        </View>

        {/* NAMN OCH BESKRIVNING */}
        <Text style={styles.nameText}>Förnamn Efternamn</Text>
        <Text style={styles.bioText}>Lorem ipsum dolor sit amet</Text>

        {/* INSTÄLLNINGSRUTA */}
        <View style={styles.card}>
          {/* Rad 1 */}
          <View style={styles.cardRow}>
            <View style={styles.rowLeft}>
              <Feather name="square" size={18} color="white" />
              <Text style={styles.cardText}>Ändra profilinformation</Text>
            </View>
          </View>
          
          {/* Rad 2 */}
          <View style={styles.cardRow}>
            <View style={styles.rowLeft}>
              <Feather name="square" size={18} color="white" />
              <Text style={styles.cardText}>Notifikationer</Text>
            </View>
            <Text style={styles.cardActionText}>PÅ</Text>
          </View>

          {/* Rad 3 */}
          <View style={styles.cardRow}>
            <View style={styles.rowLeft}>
              <Feather name="square" size={18} color="white" />
              <Text style={styles.cardText}>Språk</Text>
            </View>
            <Text style={styles.cardActionText}>Svenska</Text>
          </View>
        </View>

        {/* LOREM IPSUM RUTA 1 */}
        <View style={styles.card}>
          <Text style={styles.loremText}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          </Text>
        </View>

        {/* LOREM IPSUM RUTA 2 */}
        <View style={styles.card}>
          <Text style={styles.loremText}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation laboris nisi ut aliquip ex ea commodo consequat. Duis aute
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#9E9E9E',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  headerContainer: {
    backgroundColor: '#ffffff',
    height: 180,
    borderBottomLeftRadius: width,
    borderBottomRightRadius: width,
    transform: [{ scaleX: 1.2 }],
    alignItems: 'center',
    paddingTop: 20,
  },
  headerTopIcons: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40, 
    transform: [{ scaleX: 1 / 1.2 }], 
  },
  profileImageContainer: {
    width: 130,
    height: 130,
    backgroundColor: '#D6D6D6',
    borderRadius: 65,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -65, 
    zIndex: 10,
  },
  profileImageText: {
    fontSize: 12,
    color: '#000',
  },
  nameText: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
  },
  bioText: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#757575',
    marginHorizontal: 20,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardText: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 10,
    fontWeight: '500',
  },
  cardActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loremText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
});
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        // Döljer texten under ikonerna
        tabBarShowLabel: false, 
        
        // Design
        tabBarStyle: {
          backgroundColor: '#d4d4d4',
          borderTopWidth: 0,
          height: 70,
          elevation: 0,
          shadowOpacity: 0,
        },

		// Centrerar innehållet (ikonen) i varje flik
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        
        // Ikonfärger om de är aktiva eller ej
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#727272',
      }}
    >
      {/* Första fliken (Kartan) */}
      <Tabs.Screen
        name="index" // Detta är din startsida
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Feather name="map" size={28} color={color} />
          ),
        }}
      />

      {/* Andra fliken (Profilen/Utforska) */}
      <Tabs.Screen
        name="mapTest" // Ändra till "profile" om du skapar en profile.tsx senare
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={28} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
import { ProgressProvider } from '@/context/ProgressContext';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function RootLayout() {
  return (
    <ProgressProvider>
      <Tabs
        screenOptions={{
          tabBarShowLabel: false,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#d4d4d4',
            borderTopWidth: 0,
            height: 70,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarItemStyle: {
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarActiveTintColor: '#000',
          tabBarInactiveTintColor: '#727272',
        }}
      >
        {/* Flik 1: Kartlistan (Huvudmenyn) */}
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ color }) => (
              <Feather name="map" size={28} color={color} />
            ),
          }}
        />

        {/* Flik 2: Profilen */}
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ color }) => (
              <Feather name="user" size={28} color={color} />
            ),
          }}
        />

        {/* Dold vy: Detaljkartan (Öppnas bara när man klickar i listan) */}
        <Tabs.Screen
          name="map"
          options={{
            href: null, // Döljer ikonen från bottenmenyn
            tabBarStyle: { display: 'none' }, // Gömmer själva menyraden helt när man är på denna skärm
          }}
        />
      </Tabs>
    </ProgressProvider>
  );
}
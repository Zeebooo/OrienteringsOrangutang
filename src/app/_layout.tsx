import { AuthProvider } from '@/context/AuthContext';
import { ProgressProvider } from '@/context/ProgressContext';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

function TabIcon({ name, label, focused }: { name: any; label: string; focused: boolean }) {
  return (
    // height: '100%' gör att den tar all tillgänglig plats utan att klippas
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 80, height: '100%' }}>
      {/* Ikon */}
      <Feather
        name={name}
        size={24}
        color={focused ? Colors.light.textMain : Colors.light.textMuted}
        style={{ marginBottom: 4 }}
      />
      {/* Text */}
      <Text
        numberOfLines={1}
        style={{
          color: focused ? Colors.light.textMain : Colors.light.textMuted,
          fontSize: 12,
          fontWeight: focused ? '600' : '500',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      {/* Den orangea linjen */}
      <View
        style={{
          height: 3,
          width: 36,
          backgroundColor: focused ? Colors.light.accent : 'transparent',
          borderRadius: 2,
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
import { AuthProvider } from '@/context/AuthContext';
import { ProgressProvider } from '@/context/ProgressContext';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

function TabIcon({ name, label, focused }: { name: any; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 80, height: '100%' }}>
      {}
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
              backgroundColor: Colors.light.beigeBgDarker,
              borderTopWidth: 0,
              // Sätt en stabil höjd beroende på system
              height: Platform.OS === 'ios' ? 85 : 70,
              // HÄR ÄR MAGIN: Tvinga bort den osynliga botten-paddingen
              paddingBottom: Platform.OS === 'ios' ? 15 : 0,
              paddingTop: 10,
            },
          }}
        >
          {/* Flik 1: Kartlistan (Huvudmenyn) */}
          <Tabs.Screen
            name="index"
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon name="map" label="Kartor" focused={focused} />
              ),
            }}
          />

          {/* Flik 2: Profilen */}
          <Tabs.Screen
            name="profile"
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon name="user" label="Profil" focused={focused} />
              ),
            }}
          />

          {/* Dolda vyer: bara knappen i flikraden döljs (tabBarButton). Använd inte href: null – sedan
              SDK 58 räknas en sådan flik som spärrad, och navigerar man dit skickas man tillbaka till kartlistan. */}

          {/* tabBarItemStyle display: 'none' gör att de dolda flikarna inte heller tar plats i flikraden */}

          {/* Dold vy: Detaljkartan */}
          <Tabs.Screen
            name="map"
            options={{
              tabBarButton: () => null,
              tabBarItemStyle: { display: 'none' },
              tabBarStyle: { display: 'none' },
            }}
          />

          {/* Dold vy: Skapa en karta (öppnas från kartlistan) */}
          <Tabs.Screen
            name="create"
            options={{
              tabBarButton: () => null,
              tabBarItemStyle: { display: 'none' },
              tabBarStyle: { display: 'none' },
            }}
          />
        </Tabs>
      </ProgressProvider>
    </AuthProvider>
  );
}
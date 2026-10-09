import { Feather } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { TouchableOpacity } from 'react-native';

import { Colors } from '@/constants/theme';
import { CreateMapProvider } from '@/context/CreateMapContext';

export default function CreateLayout() {
  const router = useRouter();

  // Flikar behålls i minnet när man lämnar dem. En ny key när flödet lämnas gör att
  // React bygger upp allt på nytt: nästa gång börjar man på steg 1 med ett tomt utkast.
  const [session, setSession] = useState(0);
  useFocusEffect(
    useCallback(() => {
      return () => setSession((s) => s + 1);
    }, []),
  );

  return (
    <CreateMapProvider key={session}>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: 'Välj område',
            // Första steget har ingen tillbakapil i stacken, så vi lägger till en stängknapp
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.navigate('/')}>
                <Feather name="x" size={24} color={Colors.light.textMain} />
              </TouchableOpacity>
            ),
          }}
        />
        <Stack.Screen name="controls" options={{ title: 'Placera kontroller' }} />
        <Stack.Screen name="details" options={{ title: 'Detaljer' }} />
      </Stack>
    </CreateMapProvider>
  );
}

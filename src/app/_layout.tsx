import { ProgressProvider } from '@/context/ProgressContext';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <ProgressProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ProgressProvider>
  );
}
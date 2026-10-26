/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  // Sedan React Native 0.88 är "inget valt" null i stället för 'unspecified'
  const theme = scheme ?? 'light';

  return Colors[theme];
}

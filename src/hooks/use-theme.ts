/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  // useColorScheme peut renvoyer null (préférence système inconnue) : on
  // retombe sur le thème clair plutôt que d'indexer Colors avec null.
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}

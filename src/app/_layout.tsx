// En SDK 54, le thème de navigation vient de @react-navigation/native ;
// expo-router ne le réexporte pas (c'est le cas à partir du SDK 57).
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import migrations from '../../drizzle/migrations';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Verrou } from '@/components/verrou';
import { AmenagementsProvider } from '@/hooks/use-amenagements-visibles';
import { Spacing } from '@/constants/theme';
import { db } from '@/db';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <ThemedView style={styles.centre}>
        <ThemedText type="subtitle">Base de données inaccessible</ThemedText>
        <ThemedText type="small">{error.message}</ThemedText>
      </ThemedView>
    );
  }

  if (!success) {
    return (
      <ThemedView style={styles.centre}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Verrou>
          <AmenagementsProvider>
            <Stack>
            <Stack.Screen name="index" options={{ title: 'Mes classes' }} />
            <Stack.Screen name="classe/[id]/index" options={{ title: 'Classe' }} />
            <Stack.Screen name="classe/[id]/saisie" options={{ title: 'Saisie' }} />
              <Stack.Screen name="classe/[id]/evaluations" options={{ title: 'Notes' }} />
              <Stack.Screen name="eleve/[id]" options={{ title: 'Élève' }} />
              <Stack.Screen name="evaluation/[id]" options={{ title: 'Évaluation' }} />
            </Stack>
          </AmenagementsProvider>
        </Verrou>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
});

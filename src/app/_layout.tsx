// En SDK 54, le thème de navigation vient de @react-navigation/native ;
// expo-router ne le réexporte pas (c'est le cas à partir du SDK 57).
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import migrations from '../../drizzle/migrations';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AmenagementsProvider } from '@/hooks/use-amenagements-visibles';
import { Colors, Spacing } from '@/constants/theme';
import { db } from '@/db';
import { demanderPermissionNotifs, reprogrammerNotifications } from '@/lib/notifications';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const c = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { success, error } = useMigrations(db, migrations);

  // Notifications : une fois la base prête, on demande la permission puis on
  // (re)programme le digest + les rappels — au démarrage et à chaque retour au
  // premier plan (pour refléter les colles traitées entre-temps).
  useEffect(() => {
    if (!success) return;
    let annule = false;
    (async () => {
      await demanderPermissionNotifs();
      if (!annule) await reprogrammerNotifications();
    })();
    const sub = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') reprogrammerNotifications();
    });
    return () => {
      annule = true;
      sub.remove();
    };
  }, [success]);

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
        <AmenagementsProvider>
          <Stack
            screenOptions={{
              // fondu entre écrans, comme demandé
              animation: 'fade',
              animationDuration: 200,
              headerShadowVisible: false,
              headerStyle: { backgroundColor: c.background },
              headerTitleStyle: { color: c.text, fontWeight: '700' },
              headerTintColor: c.accent,
              contentStyle: { backgroundColor: c.background },
            }}>
            <Stack.Screen name="index" options={{ title: 'Mes classes' }} />
            <Stack.Screen name="classe/[id]/index" options={{ title: 'Classe' }} />
            <Stack.Screen name="classe/[id]/saisie" options={{ title: 'Saisie' }} />
            <Stack.Screen name="classe/[id]/evaluations" options={{ title: 'Notes' }} />
            <Stack.Screen name="classe/[id]/ordre" options={{ title: 'Ordre des élèves' }} />
            <Stack.Screen name="classe/[id]/groupes" options={{ title: 'Demi-groupes' }} />
            <Stack.Screen name="classe/[id]/edt" options={{ title: 'Emploi du temps' }} />
            <Stack.Screen name="eleve/[id]" options={{ title: 'Élève' }} />
            <Stack.Screen name="evaluation/[id]" options={{ title: 'Évaluation' }} />
            <Stack.Screen name="trimestres" options={{ title: 'Dates des trimestres' }} />
            <Stack.Screen name="colles" options={{ title: 'Colles' }} />
            <Stack.Screen name="matieres" options={{ title: 'Matières' }} />
            <Stack.Screen name="sauvegarde" options={{ title: 'Sauvegarde' }} />
          </Stack>
        </AmenagementsProvider>
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

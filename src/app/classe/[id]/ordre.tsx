import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, Colors, Radius, Spacing } from '@/constants/theme';
import { deplacerEleve, selectElevesOrdonnes } from '@/db/eleves';

export default function EcranOrdre() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classeId = Number(id);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  const { data: liste } = useLiveQuery(selectElevesOrdonnes(classeId), [classeId]);
  const total = liste?.length ?? 0;

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen options={{ title: 'Ordre des élèves' }} />

      <ScrollView
        contentContainerStyle={[styles.liste, { paddingBottom: Spacing.six + insets.bottom }]}>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          Utilise les flèches pour déplacer un élève. Les nouveaux élèves
          s’ajoutent toujours à la fin.
        </ThemedText>

        {liste?.map((e, i) => (
          <View
            key={e.inscriptionId}
            style={[styles.ligne, { backgroundColor: c.backgroundElement, borderColor: c.border }, CardShadow]}>
            <ThemedText style={[styles.rang, { color: c.textSecondary }]}>{i + 1}</ThemedText>
            <ThemedText style={styles.nom} numberOfLines={1}>
              {e.prenom || e.nom} {e.prenom ? e.nom.toLocaleUpperCase('fr-FR') : ''}
            </ThemedText>

            <Pressable
              disabled={i === 0}
              onPress={() => deplacerEleve(classeId, e.inscriptionId, 'haut')}
              style={[styles.fleche, { opacity: i === 0 ? 0.25 : 1 }]}>
              <ThemedText style={styles.flecheTexte}>↑</ThemedText>
            </Pressable>
            <Pressable
              disabled={i === total - 1}
              onPress={() => deplacerEleve(classeId, e.inscriptionId, 'bas')}
              style={[styles.fleche, { opacity: i === total - 1 ? 0.25 : 1 }]}>
              <ThemedText style={styles.flecheTexte}>↓</ThemedText>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  liste: { padding: Spacing.three, gap: Spacing.two },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    paddingLeft: Spacing.three,
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rang: { width: 26, fontSize: 14, fontWeight: '700' },
  nom: { flex: 1, fontSize: 16, fontWeight: '600' },
  fleche: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.s,
  },
  flecheTexte: { fontSize: 22, lineHeight: 26 },
});

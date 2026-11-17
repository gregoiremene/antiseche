import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { selectCollesEleve } from '@/db/colles';
import { aujourdhuiISO, formatJourCourt } from '@/lib/calendrier';

const LIBELLE_STATUT = {
  a_faire: { texte: 'à venir', couleur: '#F76B15' },
  faite: { texte: 'faite', couleur: '#30A46C' },
  non_faite: { texte: 'non faite', couleur: '#E5484D' },
} as const;

/** Colles de l'élève, affichées sur sa fiche (lecture seule ; gestion via l'écran Colles). */
export function BlocCollesEleve({ inscriptionId }: { inscriptionId: number }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const jourJ = aujourdhuiISO();

  const { data: colles } = useLiveQuery(selectCollesEleve(inscriptionId), [inscriptionId]);
  if (!colles || colles.length === 0) return null;

  return (
    <View style={{ gap: Spacing.two }}>
      <ThemedText type="small" style={{ color: c.textSecondary }}>
        Colles ({colles.length})
      </ThemedText>
      {colles.map((colle) => {
        // sans date = à programmer ; date passée non pointée = à vérifier
        const st = !colle.date
          ? { texte: 'à programmer', couleur: '#F76B15' }
          : colle.statut === 'a_faire' && colle.date < jourJ
            ? { texte: 'à vérifier', couleur: '#E5484D' }
            : LIBELLE_STATUT[colle.statut];
        return (
          <Pressable
            key={colle.id}
            onPress={() => router.push('/colles')}
            style={({ pressed }) => [
              styles.ligne,
              { backgroundColor: pressed ? c.backgroundSelected : c.backgroundElement, borderColor: c.border },
            ]}>
            <View style={{ flex: 1, gap: Spacing.half }}>
              <ThemedText style={styles.date}>
                {colle.date ? formatJourCourt(colle.date) : 'Date à définir'}
              </ThemedText>
              {colle.motif ? (
                <ThemedText type="small" style={{ color: c.textSecondary }} numberOfLines={2}>
                  {colle.motif}
                </ThemedText>
              ) : null}
            </View>
            <View style={[styles.badge, { borderColor: st.couleur }]}>
              <ThemedText type="small" style={{ color: st.couleur }}>
                {st.texte}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.s,
    borderWidth: StyleSheet.hairlineWidth,
  },
  date: { fontSize: 15, fontWeight: '600' },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
});

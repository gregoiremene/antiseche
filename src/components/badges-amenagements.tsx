import { StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAmenagementsVisibles } from '@/hooks/use-amenagements-visibles';

/**
 * Badges d'aménagement affichés à côté du nom.
 *
 * Tous les tags partagent la même couleur : l'information utile en un coup
 * d'œil est « cet élève a un aménagement », le détail se lit ensuite. Des
 * couleurs différentes par type transformeraient la liste en arc-en-ciel sans
 * rien apprendre de plus.
 */
export function BadgesAmenagements({
  amenagements,
  max = 2,
  /**
   * Ignore le réglage de visibilité. Réservé à la fiche élève : on y arrive en
   * ouvrant délibérément UN élève, il n'y a donc pas de lecture de masse à
   * empêcher, et masquer le dossier sur sa propre fiche n'aurait pas de sens.
   */
  toujoursVisible = false,
}: {
  amenagements: string[];
  max?: number;
  toujoursVisible?: boolean;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const { visibles: reglageActif } = useAmenagementsVisibles();

  if (amenagements.length === 0) return null;
  if (!toujoursVisible && !reglageActif) return null;

  const visibles = amenagements.slice(0, max);
  const restants = amenagements.length - visibles.length;

  return (
    <View style={styles.rangee}>
      {visibles.map((a) => (
        <View key={a} style={[styles.badge, { backgroundColor: COULEUR_BADGE }]}>
          <ThemedText style={styles.texte}>{a}</ThemedText>
        </View>
      ))}
      {restants > 0 && (
        <View style={[styles.badge, { backgroundColor: c.backgroundSelected }]}>
          <ThemedText style={[styles.texte, { color: c.textSecondary }]}>+{restants}</ThemedText>
        </View>
      )}
    </View>
  );
}

/** ambre : visible sur fond clair comme sombre, sans évoquer une alerte */
const COULEUR_BADGE = '#B8860B';

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, alignItems: 'center' },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 999,
  },
  texte: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

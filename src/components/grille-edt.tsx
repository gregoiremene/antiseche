import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type DimensionValue } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { texteSurCouleur } from '@/constants/couleurs';
import { Spacing, type ThemeColors } from '@/constants/theme';
import type { SemaineEdt } from '@/db/schema';
import { heureEnMinutes } from '@/lib/semaine-ab';

/**
 * Grille temporelle façon carnet, PARTAGÉE entre l'éditeur d'EDT d'une classe et
 * l'emploi du temps personnel du prof sur l'accueil. Purement présentationnelle :
 * on lui passe des « blocs » déjà normalisés, elle les positionne et les
 * dimensionne selon leur horaire réel (2 h = deux fois plus haut). Une colonne
 * par jour, coupée en deux (semaine A à gauche, B à droite).
 */

export const JOURS = [
  { num: 1, court: 'Lun', long: 'Lundi' },
  { num: 2, court: 'Mar', long: 'Mardi' },
  { num: 3, court: 'Mer', long: 'Mercredi' },
  { num: 4, court: 'Jeu', long: 'Jeudi' },
  { num: 5, court: 'Ven', long: 'Vendredi' },
  { num: 6, court: 'Sam', long: 'Samedi' },
] as const;

export type Jour = (typeof JOURS)[number];

/** Un cours affichable dans la grille, indépendant de sa source (classe / moi). */
export type BlocEdt = {
  id: number;
  jour: number; // 1 = lundi … 6 = samedi
  heureDebut: string; // "HH:MM"
  heureFin: string;
  semaine: SemaineEdt;
  /** couleur de fond ; null → gris neutre du thème */
  couleur: string | null;
  /** libellé principal (matière, ou nom de classe pour l'EDT perso) */
  titre: string;
  salle?: string | null;
  /** petit libellé secondaire (groupe), déjà résolu en « G1 »/nom perso */
  badge?: string | null;
  /** liseré d'accent à gauche (heures « mon cours » dans l'EDT d'une classe) */
  monCours?: boolean;
};

const PX_PAR_MIN = 1; // 1 min = 1 px → une heure fait 60 px de haut
const GUTTER = 34; // largeur de la colonne des heures
const DEBUT_JOURNEE = 8 * 60; // la grille commence au plus tard à 8h
const FIN_JOURNEE = 18 * 60; // la grille descend au moins jusqu'à 18h

/**
 * Position horizontale d'un bloc dans sa colonne selon sa semaine : « toutes »
 * prend toute la largeur, A la moitié gauche, B la moitié droite.
 */
function positionHoriz(semaine: SemaineEdt): { left: DimensionValue; right: DimensionValue } {
  if (semaine === 'A') return { left: 0, right: '50%' };
  if (semaine === 'B') return { left: '50%', right: 0 };
  return { left: 0, right: 0 };
}

export function GrilleEdt({
  c,
  blocs,
  jours,
  montrerEntete,
  defilant = true,
  insetBottom = 0,
  vide,
  onTap,
  onLong,
}: {
  c: ThemeColors;
  blocs: BlocEdt[];
  jours: Jour[];
  montrerEntete: boolean;
  /** true (défaut) → la grille possède son propre ScrollView (plein écran) ;
   *  false → simple View, à placer dans un parent qui défile (accueil). */
  defilant?: boolean;
  insetBottom?: number;
  /** message affiché quand il n'y a aucun bloc (sinon rien) */
  vide?: string;
  onTap?: (id: number) => void;
  onLong?: (id: number) => void;
}) {
  const numsAffiches = useMemo(() => new Set<number>(jours.map((j) => j.num)), [jours]);
  const visibles = useMemo(
    () => blocs.filter((b) => numsAffiches.has(b.jour)),
    [blocs, numsAffiches],
  );

  const { debutMin, finMin, heures } = useMemo(() => {
    if (visibles.length === 0) return { debutMin: 0, finMin: 0, heures: [] as number[] };
    let min = Infinity;
    let max = -Infinity;
    for (const b of visibles) {
      min = Math.min(min, heureEnMinutes(b.heureDebut));
      max = Math.max(max, heureEnMinutes(b.heureFin));
    }
    const debutMin = Math.min(Math.floor(min / 60) * 60, DEBUT_JOURNEE);
    const finMin = Math.max(Math.ceil(max / 60) * 60, FIN_JOURNEE);
    const heures: number[] = [];
    for (let h = debutMin / 60; h <= finMin / 60; h++) heures.push(h);
    return { debutMin, finMin, heures };
  }, [visibles]);

  if (visibles.length === 0) {
    if (!vide) return null;
    return (
      <View style={styles.corps}>
        <ThemedText style={[styles.vide, { color: c.textSecondary }]}>{vide}</ThemedText>
      </View>
    );
  }

  const hauteur = (finMin - debutMin) * PX_PAR_MIN;

  const contenu = (
    <>
      {montrerEntete && (
        <View style={styles.grilleEntete}>
          <View style={{ width: GUTTER }} />
          {jours.map((j) => (
            <View key={j.num} style={[styles.grilleColEntete, { borderColor: c.border }]}>
              <ThemedText type="small" style={{ fontWeight: '700' }}>
                {j.court}
              </ThemedText>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.grilleCorps, { height: hauteur }]}>
        {/* colonne des heures */}
        <View style={{ width: GUTTER }}>
          {heures.map((h) => (
            <ThemedText
              key={h}
              type="small"
              style={[styles.heureAxe, { top: (h * 60 - debutMin) * PX_PAR_MIN - 7, color: c.textSecondary }]}>
              {h}h
            </ThemedText>
          ))}
        </View>

        {/* une colonne par jour, coupée A | B */}
        {jours.map((j) => {
          const duJour = visibles.filter((b) => b.jour === j.num);
          return (
            <View key={j.num} style={[styles.grilleCol, { borderColor: c.border }]}>
              {heures.map((h) => (
                <View
                  key={h}
                  style={[styles.filetHeure, { top: (h * 60 - debutMin) * PX_PAR_MIN, backgroundColor: c.border }]}
                />
              ))}
              <View style={[styles.filetAB, { backgroundColor: c.border }]} />

              {duJour.map((b) => {
                const top = (heureEnMinutes(b.heureDebut) - debutMin) * PX_PAR_MIN;
                const h = (heureEnMinutes(b.heureFin) - heureEnMinutes(b.heureDebut)) * PX_PAR_MIN;
                const fond = b.couleur ?? c.backgroundSelected;
                const texte = b.couleur ? texteSurCouleur(b.couleur) : c.text;
                const specifique = b.semaine !== 'toutes';
                return (
                  <Pressable
                    key={b.id}
                    onPress={onTap ? () => onTap(b.id) : undefined}
                    onLongPress={onLong ? () => onLong(b.id) : undefined}
                    style={[
                      styles.bloc,
                      positionHoriz(b.semaine),
                      { top, height: h, backgroundColor: fond, borderColor: c.background },
                    ]}>
                    {b.monCours && <View style={[styles.blocMoi, { backgroundColor: c.accent }]} />}
                    <ThemedText
                      numberOfLines={b.badge ? 1 : 2}
                      style={{ color: texte, fontSize: 10, fontWeight: '700', paddingRight: specifique ? 12 : 0 }}>
                      {b.titre}
                    </ThemedText>
                    {b.badge && (
                      <ThemedText
                        numberOfLines={1}
                        style={{ color: texte, fontSize: 9, fontWeight: '700', opacity: 0.9 }}>
                        {b.badge}
                      </ThemedText>
                    )}
                    {h >= 40 && b.salle && (
                      <ThemedText style={{ color: texte, fontSize: 9, opacity: 0.9 }}>{b.salle}</ThemedText>
                    )}
                    {specifique && (
                      <View style={styles.blocAB}>
                        <ThemedText style={styles.blocABTexte}>{b.semaine}</ThemedText>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>
    </>
  );

  if (!defilant) return <View>{contenu}</View>;

  return (
    <ScrollView style={styles.corps} contentContainerStyle={{ paddingBottom: Spacing.six + insetBottom }}>
      {contenu}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  corps: { flex: 1 },
  vide: { textAlign: 'center', margin: Spacing.four, lineHeight: 20 },
  grilleEntete: { flexDirection: 'row' },
  grilleColEntete: { flex: 1, alignItems: 'center', paddingVertical: Spacing.one, borderLeftWidth: StyleSheet.hairlineWidth },
  grilleCorps: { flexDirection: 'row' },
  grilleCol: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, position: 'relative' },
  heureAxe: { position: 'absolute', right: 4, textAlign: 'right' },
  filetHeure: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  filetAB: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: StyleSheet.hairlineWidth },
  bloc: {
    position: 'absolute',
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 3,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  blocMoi: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  blocAB: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 3,
    paddingBottom: 1,
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  blocABTexte: { color: '#fff', fontSize: 9, fontWeight: '800' },
});

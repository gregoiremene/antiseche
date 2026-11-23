import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OBSERVATIONS } from '@/constants/observations';
import { CardShadow, Colors, Radius, Spacing } from '@/constants/theme';
import { db } from '@/db';
import { selectElevesOrdonnes } from '@/db/eleves';
import { enregistrerObservations } from '@/db/observations';
import { classes, type TypeObservation } from '@/db/schema';

export default function EcranSaisieRapide() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classeId = Number(id);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  // « Exo non fait » par défaut : c'est le cas le plus fréquent, donc zéro tap
  // pour le choisir.
  const [type, setType] = useState<TypeObservation>('exo_non_fait');
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [enCours, setEnCours] = useState(false);
  // filtre de demi-groupe : « Tous » par défaut, ou un seul groupe quand on fait
  // cours en effectif réduit
  const [filtreGroupe, setFiltreGroupe] = useState<'tous' | 1 | 2>('tous');

  const { data: infosClasse } = useLiveQuery(
    db.select().from(classes).where(eq(classes.id, classeId)),
    [classeId],
  );
  const classe = infosClasse?.[0];

  const { data: liste } = useLiveQuery(selectElevesOrdonnes(classeId), [classeId]);

  // élèves affichés selon le filtre de groupe
  const listeVisible = (liste ?? []).filter(
    (e) => filtreGroupe === 'tous' || e.groupe === filtreGroupe,
  );

  // en changeant de groupe, on retire de la sélection les élèves désormais
  // masqués : on ne valide jamais un élève qu'on ne voit plus.
  function changerFiltre(valeur: 'tous' | 1 | 2) {
    setFiltreGroupe(valeur);
    const visibles = new Set(
      (liste ?? [])
        .filter((e) => valeur === 'tous' || e.groupe === valeur)
        .map((e) => e.inscriptionId),
    );
    setSelection((prec) => new Set([...prec].filter((id) => visibles.has(id))));
  }

  const obs = OBSERVATIONS.find((o) => o.type === type) ?? OBSERVATIONS[0];

  function basculer(inscriptionId: number) {
    setSelection((precedente) => {
      const suivante = new Set(precedente);
      if (suivante.has(inscriptionId)) suivante.delete(inscriptionId);
      else suivante.add(inscriptionId);
      return suivante;
    });
  }

  async function valider() {
    if (selection.size === 0 || enCours) return;
    setEnCours(true);
    await enregistrerObservations([...selection], type);
    router.back();
  }

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen options={{ title: classe?.nom ? `Saisie · ${classe.nom}` : 'Saisie' }} />

      {/* Filtre de demi-groupe : n'affiche que les élèves présents ce jour-là */}
      <View style={styles.filtres}>
        {([
          { v: 'tous' as const, label: 'Tous' },
          { v: 1 as const, label: classe?.groupe1Nom ?? 'Groupe 1' },
          { v: 2 as const, label: classe?.groupe2Nom ?? 'Groupe 2' },
        ]).map((opt) => {
          const actif = filtreGroupe === opt.v;
          return (
            <Pressable
              key={String(opt.v)}
              onPress={() => changerFiltre(opt.v)}
              style={[
                styles.filtrePuce,
                { borderColor: actif ? c.accent : c.border, backgroundColor: actif ? c.accent : 'transparent' },
              ]}>
              <ThemedText style={[styles.filtreTexte, { color: actif ? c.accentText : c.text }]} numberOfLines={1}>
                {opt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* La liste occupe tout l'écran et défile derrière la barre du bas :
          on garde les yeux sur les élèves, les contrôles restent sous le pouce.
          padding bas = sélecteur (~44) + bouton (56) + marges + inset. */}
      <ScrollView
        contentContainerStyle={[styles.liste, { paddingBottom: 190 + insets.bottom }]}>
        {listeVisible.map((e) => {
          const choisi = selection.has(e.inscriptionId);
          return (
            <Pressable
              key={e.inscriptionId}
              onPress={() => basculer(e.inscriptionId)}
              style={[
                styles.ligne,
                {
                  backgroundColor: choisi ? obs.couleur : c.backgroundElement,
                },
              ]}>
              <View
                style={[
                  styles.case,
                  { borderColor: choisi ? '#fff' : c.textSecondary },
                  choisi && styles.caseCochee,
                ]}>
                {choisi && <ThemedText style={styles.coche}>✓</ThemedText>}
              </View>
              <ThemedText
                style={[styles.nom, { color: choisi ? '#fff' : c.text }]}
                numberOfLines={1}>
                {e.nom.toLocaleUpperCase('fr-FR')} {e.prenom}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Barre du bas : sélecteur de type compact + validation */}
      <View style={[styles.barreBas, { paddingBottom: Spacing.two + insets.bottom }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.types}>
          {OBSERVATIONS.map((o) => {
            const actif = o.type === type;
            return (
              <Pressable
                key={o.type}
                onPress={() => setType(o.type)}
                style={[styles.puce, { backgroundColor: actif ? o.couleur : c.backgroundElement }]}>
                <ThemedText style={[styles.puceTexte, { color: actif ? '#fff' : c.text }]}>
                  {o.emoji} {o.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <PressableScale
          onPress={valider}
          disabled={selection.size === 0}
          style={[
            styles.valider,
            CardShadow,
            { backgroundColor: obs.couleur, opacity: selection.size === 0 ? 0.4 : 1 },
          ]}>
          <ThemedText style={styles.validerTexte}>
            {selection.size === 0
              ? `Sélectionne les élèves concernés`
              : `Valider · ${selection.size} élève${selection.size > 1 ? 's' : ''}`}
          </ThemedText>
        </PressableScale>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  filtres: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  filtrePuce: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  filtreTexte: { fontSize: 13, fontWeight: '700' },
  barreBas: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.two,
    gap: Spacing.two,
    // léger voile pour détacher la barre de la liste qui défile dessous
    backgroundColor: 'rgba(127,127,127,0.06)',
  },
  types: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  puce: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  puceTexte: { fontSize: 13, fontWeight: '600' },
  liste: { paddingHorizontal: Spacing.three, gap: Spacing.one, paddingTop: Spacing.two },
  // lignes hautes et pleine largeur : on tape en marchant dans les rangs
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: 54,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.s,
  },
  case: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseCochee: { backgroundColor: 'rgba(255,255,255,0.25)' },
  coche: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 18 },
  nom: { fontSize: 16, fontWeight: '600', flex: 1 },
  valider: {
    marginHorizontal: Spacing.three,
    height: 52,
    borderRadius: Radius.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validerTexte: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
});

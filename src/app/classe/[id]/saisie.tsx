import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OBSERVATIONS } from '@/constants/observations';
import { Colors, Spacing } from '@/constants/theme';
import { db } from '@/db';
import { enregistrerObservations } from '@/db/observations';
import { classes, eleves, inscriptions, type TypeObservation } from '@/db/schema';

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

  const { data: infosClasse } = useLiveQuery(
    db.select().from(classes).where(eq(classes.id, classeId)),
    [classeId],
  );
  const classe = infosClasse?.[0];

  const { data: liste } = useLiveQuery(
    db
      .select({
        inscriptionId: inscriptions.id,
        nom: eleves.nom,
        prenom: eleves.prenom,
      })
      .from(inscriptions)
      .innerJoin(eleves, eq(eleves.id, inscriptions.eleveId))
      .where(eq(inscriptions.classeId, classeId))
      .orderBy(asc(eleves.nom), asc(eleves.prenom)),
    [classeId],
  );

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

      {/* Choix du type : une seule rangée, atteignable sans réfléchir */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.types}>
        {OBSERVATIONS.map((o) => {
          const actif = o.type === type;
          return (
            <Pressable
              key={o.type}
              onPress={() => setType(o.type)}
              style={[
                styles.puce,
                { backgroundColor: actif ? o.couleur : c.backgroundElement },
              ]}>
              <ThemedText style={[styles.puceTexte, { color: actif ? '#fff' : c.text }]}>
                {o.emoji} {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.liste, { paddingBottom: 100 + insets.bottom }]}>
        {liste?.map((e) => {
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

      <Pressable
        onPress={valider}
        disabled={selection.size === 0}
        style={[
          styles.valider,
          {
            backgroundColor: obs.couleur,
            opacity: selection.size === 0 ? 0.4 : 1,
            bottom: Spacing.four + insets.bottom,
          },
        ]}>
        <ThemedText style={styles.validerTexte}>
          {selection.size === 0
            ? `Sélectionne les élèves concernés`
            : `Valider · ${selection.size} élève${selection.size > 1 ? 's' : ''}`}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  types: { padding: Spacing.three, gap: Spacing.two },
  puce: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  puceTexte: { fontSize: 14, fontWeight: '600' },
  liste: { paddingHorizontal: Spacing.three, gap: Spacing.one, paddingBottom: 100 },
  // lignes hautes et pleine largeur : on tape en marchant dans les rangs
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: 54,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
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
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.four,
    height: 56,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validerTexte: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

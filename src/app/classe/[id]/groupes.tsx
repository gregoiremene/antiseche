import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { db } from '@/db';
import { selectElevesOrdonnes } from '@/db/eleves';
import {
  definirGroupeEleve,
  repartirGroupes,
  renommerGroupes,
  selectLibellesGroupes,
  type Groupe,
} from '@/db/groupes';
import { classes } from '@/db/schema';

export default function EcranGroupes() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classeId = Number(id);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  const { data: infosClasse } = useLiveQuery(
    db.select({ nom: classes.nom }).from(classes).where(eq(classes.id, classeId)),
    [classeId],
  );
  const nomClasse = infosClasse?.[0]?.nom;

  const { data: libelles } = useLiveQuery(selectLibellesGroupes(classeId), [classeId]);
  const { data: liste } = useLiveQuery(selectElevesOrdonnes(classeId), [classeId]);

  // noms éditables : état local calé sur la base, enregistré à la demande
  const base1 = libelles?.[0]?.groupe1Nom;
  const base2 = libelles?.[0]?.groupe2Nom;
  const [nom1, setNom1] = useState('');
  const [nom2, setNom2] = useState('');
  useEffect(() => {
    if (base1 !== undefined) setNom1(base1);
    if (base2 !== undefined) setNom2(base2);
  }, [base1, base2]);

  const g1Nom = base1 ?? 'Groupe 1';
  const g2Nom = base2 ?? 'Groupe 2';
  const nbG1 = liste?.filter((e) => e.groupe === 1).length ?? 0;
  const nbG2 = liste?.filter((e) => e.groupe === 2).length ?? 0;

  const nomsModifies = base1 !== undefined && (nom1 !== base1 || nom2 !== base2);

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen options={{ title: nomClasse ? `Groupes · ${nomClasse}` : 'Groupes' }} />

      <ScrollView contentContainerStyle={[styles.corps, { paddingBottom: Spacing.six + insets.bottom }]}>
        {/* Renommer les deux groupes */}
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          Nom des groupes
        </ThemedText>
        <View style={styles.nomsLigne}>
          <TextInput
            value={nom1}
            onChangeText={setNom1}
            placeholder="Groupe 1"
            placeholderTextColor={c.textSecondary}
            style={[styles.champNom, { color: c.text, borderColor: c.border }]}
          />
          <TextInput
            value={nom2}
            onChangeText={setNom2}
            placeholder="Groupe 2"
            placeholderTextColor={c.textSecondary}
            style={[styles.champNom, { color: c.text, borderColor: c.border }]}
          />
        </View>
        {nomsModifies && (
          <PressableScale
            onPress={() => renommerGroupes(classeId, nom1, nom2)}
            style={[styles.boutonPlein, { backgroundColor: c.accent }]}>
            <ThemedText style={{ color: c.accentText, fontWeight: '700' }}>Enregistrer les noms</ThemedText>
          </PressableScale>
        )}

        {/* Répartition automatique */}
        <ThemedText type="small" style={{ color: c.textSecondary, marginTop: Spacing.three }}>
          Répartir automatiquement (d’après l’ordre des élèves)
        </ThemedText>
        <View style={styles.actionsLigne}>
          <PressableScale
            onPress={() => repartirGroupes(classeId, 'moitie')}
            style={[styles.boutonContour, { borderColor: c.border }]}>
            <ThemedText style={{ color: c.text, fontWeight: '700' }}>1ʳᵉ / 2ᵉ moitié</ThemedText>
          </PressableScale>
          <PressableScale
            onPress={() => repartirGroupes(classeId, 'alternance')}
            style={[styles.boutonContour, { borderColor: c.border }]}>
            <ThemedText style={{ color: c.text, fontWeight: '700' }}>Un sur deux</ThemedText>
          </PressableScale>
        </View>

        {/* Répartition manuelle */}
        <View style={styles.compteLigne}>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            {g1Nom} · {nbG1}
          </ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            {g2Nom} · {nbG2}
          </ThemedText>
        </View>

        {liste?.map((e) => (
          <View
            key={e.inscriptionId}
            style={[styles.ligne, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
            <ThemedText style={styles.nom} numberOfLines={1}>
              {e.nom.toLocaleUpperCase('fr-FR')} {e.prenom}
            </ThemedText>
            <View style={styles.segment}>
              {([1, 2] as Groupe[]).map((gr) => {
                const actif = e.groupe === gr;
                return (
                  <Pressable
                    key={gr}
                    onPress={() => definirGroupeEleve(e.inscriptionId, gr)}
                    style={[
                      styles.segmentCase,
                      { borderColor: c.border },
                      actif && { backgroundColor: c.accent },
                    ]}>
                    <ThemedText
                      type="small"
                      style={{ color: actif ? c.accentText : c.textSecondary, fontWeight: '700' }}>
                      {gr === 1 ? 'G1' : 'G2'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  corps: { padding: Spacing.three, gap: Spacing.two },
  nomsLigne: { flexDirection: 'row', gap: Spacing.two },
  champNom: { flex: 1, borderWidth: 1, borderRadius: Radius.s, padding: Spacing.three, fontSize: 16 },
  boutonPlein: { padding: Spacing.three, borderRadius: Radius.s, alignItems: 'center', marginTop: Spacing.one },
  actionsLigne: { flexDirection: 'row', gap: Spacing.two },
  boutonContour: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.s,
    borderWidth: 1,
  },
  compteLigne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.s,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nom: { fontSize: 16, fontWeight: '600', flex: 1 },
  segment: { flexDirection: 'row', gap: Spacing.one },
  segmentCase: {
    width: 44,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.s,
    borderWidth: 1,
  },
});

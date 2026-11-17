import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { definirBornesTrimestres } from '@/db/annees';
import { useAnneeActive } from '@/hooks/use-annee-active';
import { formatDateCourte } from '@/lib/trimestre';

/** "2026-11-30" -> { jour: "30", mois: "11" } */
function decouper(date: string): { jour: string; mois: string } {
  const [, mois, jour] = date.split('-');
  return { jour: String(Number(jour)), mois: String(Number(mois)) };
}

/**
 * Reconstitue une date complète. L'année est déduite du calendrier scolaire :
 * un mois de septembre à décembre appartient à l'année de début, sinon à celle
 * de fin. Ça évite de demander l'année à l'utilisateur.
 */
function recomposer(libelleAnnee: string, jour: string, mois: string): string | null {
  const j = Number(jour);
  const m = Number(mois);
  if (!Number.isInteger(j) || !Number.isInteger(m) || m < 1 || m > 12 || j < 1 || j > 31) {
    return null;
  }
  const [debut, fin] = libelleAnnee.split('-').map(Number);
  const annee = m >= 8 ? debut : fin;
  const iso = `${annee}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
  // rejette un 31 avril etc. : on revérifie que la date existe vraiment
  const d = new Date(`${iso}T00:00:00Z`);
  return d.getUTCMonth() + 1 === m && d.getUTCDate() === j ? iso : null;
}

export default function EcranTrimestres() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { annee, bornes } = useAnneeActive();

  const [t1, setT1] = useState({ jour: '', mois: '' });
  const [t2, setT2] = useState({ jour: '', mois: '' });

  useEffect(() => {
    if (bornes) {
      setT1(decouper(bornes.finT1));
      setT2(decouper(bornes.finT2));
    }
  }, [bornes]);

  function enregistrer() {
    if (!annee) return;
    const finT1 = recomposer(annee.libelle, t1.jour, t1.mois);
    const finT2 = recomposer(annee.libelle, t2.jour, t2.mois);
    if (!finT1 || !finT2) {
      Alert.alert('Date invalide', 'Vérifie le jour et le mois de chaque date.');
      return;
    }
    if (finT1 >= finT2) {
      Alert.alert('Ordre incohérent', 'La fin du T1 doit précéder la fin du T2.');
      return;
    }
    definirBornesTrimestres(annee.id, finT1, finT2);
    router.back();
  }

  const champ = (
    valeur: { jour: string; mois: string },
    set: (v: { jour: string; mois: string }) => void,
  ) => (
    <View style={styles.dateLigne}>
      <TextInput
        value={valeur.jour}
        onChangeText={(jour) => set({ ...valeur, jour })}
        keyboardType="numeric"
        placeholder="JJ"
        placeholderTextColor={c.textSecondary}
        maxLength={2}
        style={[styles.champDate, { color: c.text, borderColor: c.backgroundSelected }]}
      />
      <ThemedText style={{ color: c.textSecondary }}>/</ThemedText>
      <TextInput
        value={valeur.mois}
        onChangeText={(mois) => set({ ...valeur, mois })}
        keyboardType="numeric"
        placeholder="MM"
        placeholderTextColor={c.textSecondary}
        maxLength={2}
        style={[styles.champDate, { color: c.text, borderColor: c.backgroundSelected }]}
      />
    </View>
  );

  const apercu = (v: { jour: string; mois: string }) => {
    if (!annee) return '';
    const iso = recomposer(annee.libelle, v.jour, v.mois);
    return iso ? formatDateCourte(iso) : '—';
  };

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen options={{ title: 'Dates des trimestres' }} />

      <View style={[styles.contenu, { paddingBottom: insets.bottom + Spacing.four }]}>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          Année {annee?.libelle ?? '…'}. Ces dates découpent les trimestres pour
          les moyennes et les totaux d’observations. Modifiables à tout moment.
        </ThemedText>

        <View style={[styles.bloc, { backgroundColor: c.backgroundElement }]}>
          <View style={styles.rangeeChamp}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.label}>Dernier jour du T1</ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {apercu(t1)}
              </ThemedText>
            </View>
            {champ(t1, setT1)}
          </View>

          <View style={[styles.separateur, { backgroundColor: c.backgroundSelected }]} />

          <View style={styles.rangeeChamp}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.label}>Dernier jour du T2</ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {apercu(t2)}
              </ThemedText>
            </View>
            {champ(t2, setT2)}
          </View>
        </View>

        <ThemedText type="small" style={{ color: c.textSecondary }}>
          Le T3 court de la fin du T2 à la fin de l’année scolaire.
        </ThemedText>

        <PressableScale onPress={enregistrer} style={[styles.bouton, { backgroundColor: c.accent }]}>
          <ThemedText style={[styles.boutonTexte, { color: c.accentText }]}>Enregistrer</ThemedText>
        </PressableScale>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { padding: Spacing.three, gap: Spacing.three },
  bloc: { borderRadius: Radius.m, padding: Spacing.three },
  rangeeChamp: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two },
  label: { fontSize: 16, fontWeight: '600' },
  dateLigne: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  champDate: {
    width: 52,
    borderWidth: 1,
    borderRadius: Radius.s,
    padding: Spacing.two,
    fontSize: 18,
    textAlign: 'center',
  },
  separateur: { height: StyleSheet.hairlineWidth },
  bouton: { padding: Spacing.three, borderRadius: Radius.s, alignItems: 'center' },
  boutonTexte: { fontSize: 15, fontWeight: '600' },
});

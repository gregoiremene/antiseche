import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { db } from '@/db';
import { saisirNote } from '@/db/evaluations';
import { eleves, evaluations, inscriptions, notes } from '@/db/schema';
import { formatMoyenne, moyenne, moyenneClasse } from '@/lib/moyennes';

export default function SaisieNotes() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const evaluationId = Number(id);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  /**
   * Ce que l'utilisateur a tapé depuis l'ouverture de l'écran. On n'y écrit
   * jamais depuis la base : la valeur affichée est `brouillon[x] ?? valeurBase`,
   * ce qui évite qu'un rafraîchissement live écrase la frappe en cours.
   */
  const [brouillon, setBrouillon] = useState<Record<number, string>>({});

  const { data: infos } = useLiveQuery(
    db.select().from(evaluations).where(eq(evaluations.id, evaluationId)),
    [evaluationId],
  );
  const evaluation = infos?.[0];

  const { data: liste } = useLiveQuery(
    db
      .select({
        inscriptionId: inscriptions.id,
        nom: eleves.nom,
        prenom: eleves.prenom,
      })
      .from(inscriptions)
      .innerJoin(eleves, eq(eleves.id, inscriptions.eleveId))
      .where(eq(inscriptions.classeId, evaluation?.classeId ?? -1))
      .orderBy(asc(eleves.nom), asc(eleves.prenom)),
    [evaluation?.classeId],
  );

  const { data: notesSaisies } = useLiveQuery(
    db
      .select({
        inscriptionId: notes.inscriptionId,
        valeur: notes.valeur,
        absent: notes.absent,
      })
      .from(notes)
      .where(eq(notes.evaluationId, evaluationId)),
    [evaluationId],
  );

  const parEleve = useMemo(() => {
    const map = new Map<number, { valeur: number | null; absent: boolean }>();
    for (const n of notesSaisies ?? []) {
      map.set(n.inscriptionId, { valeur: n.valeur, absent: n.absent });
    }
    return map;
  }, [notesSaisies]);

  const bareme = evaluation?.bareme ?? 20;

  const moyenneEval = useMemo(
    () =>
      moyenneClasse(
        (notesSaisies ?? []).map((n) =>
          moyenne([{ valeur: n.valeur, absent: n.absent, bareme, coef: 1 }]),
        ),
      ),
    [notesSaisies, bareme],
  );

  function valeurAffichee(inscriptionId: number): string {
    if (brouillon[inscriptionId] !== undefined) return brouillon[inscriptionId];
    const enBase = parEleve.get(inscriptionId);
    if (!enBase || enBase.valeur === null) return '';
    return String(enBase.valeur).replace('.', ',');
  }

  function estInvalide(texte: string): boolean {
    if (texte.trim() === '') return false;
    const n = Number(texte.replace(',', '.'));
    return !Number.isFinite(n) || n < 0 || n > bareme;
  }

  async function enregistrer(inscriptionId: number) {
    const texte = brouillon[inscriptionId];
    if (texte === undefined) return;
    if (estInvalide(texte)) return; // on garde la frappe à l'écran sans écrire

    const brut = texte.trim();
    const valeur = brut === '' ? null : Number(brut.replace(',', '.'));
    const absent = parEleve.get(inscriptionId)?.absent ?? false;
    await saisirNote(evaluationId, inscriptionId, valeur, valeur === null ? absent : false);
  }

  async function basculerAbsent(inscriptionId: number) {
    const actuel = parEleve.get(inscriptionId);
    const devientAbsent = !(actuel?.absent ?? false);
    setBrouillon((b) => ({ ...b, [inscriptionId]: '' }));
    await saisirNote(evaluationId, inscriptionId, null, devientAbsent);
  }

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen options={{ title: evaluation?.titre ?? 'Évaluation' }} />

      <ScrollView
        contentContainerStyle={[styles.liste, { paddingBottom: Spacing.six + insets.bottom }]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.bandeau, { backgroundColor: c.backgroundElement }]}>
          <View style={{ flex: 1, gap: Spacing.half }}>
            <ThemedText type="small" style={{ color: c.textSecondary }}>
              Moyenne de la classe
            </ThemedText>
            <ThemedText style={styles.moyenne}>{formatMoyenne(moyenneEval)} / 20</ThemedText>
          </View>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            /{bareme} · coef {evaluation?.coef ?? 1}
          </ThemedText>
        </View>

        {liste?.map((e) => {
          const enBase = parEleve.get(e.inscriptionId);
          const absent = enBase?.absent ?? false;
          const texte = valeurAffichee(e.inscriptionId);
          const invalide = estInvalide(brouillon[e.inscriptionId] ?? '');

          return (
            <View
              key={e.inscriptionId}
              style={[styles.ligne, { backgroundColor: c.backgroundElement }]}>
              <ThemedText style={styles.nom} numberOfLines={1}>
                {e.nom.toLocaleUpperCase('fr-FR')} {e.prenom}
              </ThemedText>

              <TextInput
                value={absent ? '' : texte}
                editable={!absent}
                onChangeText={(t) => setBrouillon((b) => ({ ...b, [e.inscriptionId]: t }))}
                onEndEditing={() => enregistrer(e.inscriptionId)}
                onBlur={() => enregistrer(e.inscriptionId)}
                keyboardType="numeric"
                placeholder={absent ? '—' : '–'}
                placeholderTextColor={c.textSecondary}
                style={[
                  styles.champNote,
                  {
                    color: c.text,
                    borderColor: invalide ? '#E5484D' : c.backgroundSelected,
                    opacity: absent ? 0.4 : 1,
                  },
                ]}
              />

              <Pressable
                onPress={() => basculerAbsent(e.inscriptionId)}
                style={[
                  styles.abs,
                  {
                    backgroundColor: absent ? '#8E4EC6' : 'transparent',
                    borderColor: absent ? '#8E4EC6' : c.backgroundSelected,
                  },
                ]}>
                <ThemedText type="small" style={{ color: absent ? '#fff' : c.textSecondary }}>
                  Abs
                </ThemedText>
              </Pressable>
            </View>
          );
        })}

        <ThemedText type="small" style={[styles.aide, { color: c.textSecondary }]}>
          Les absents ne comptent pas dans les moyennes. Une note hors barème
          (0 à {bareme}) est encadrée en rouge et n’est pas enregistrée.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  liste: { padding: Spacing.three, gap: Spacing.two },
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  moyenne: { fontSize: 26, fontWeight: '700' },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    paddingLeft: Spacing.three,
    borderRadius: Spacing.two,
  },
  nom: { flex: 1, fontSize: 15, fontWeight: '600' },
  champNote: {
    width: 68,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  abs: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  aide: { marginTop: Spacing.three, textAlign: 'center' },
});

import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CardShadow, Colors, Radius, Spacing } from '@/constants/theme';
import { db } from '@/db';
import { evaluations, inscriptions, notes } from '@/db/schema';
import { formatJourCourt } from '@/lib/calendrier';
import { formatMoyenne, moyenne } from '@/lib/moyennes';
import { TRIMESTRES } from '@/lib/trimestre';

/** Moyennes et détail des notes d'un élève, par trimestre. */
export function BlocNotesEleve({ eleveId }: { eleveId: number }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];

  const { data: sesNotes } = useLiveQuery(
    db
      .select({
        valeur: notes.valeur,
        absent: notes.absent,
        bareme: evaluations.bareme,
        coef: evaluations.coef,
        trimestre: evaluations.trimestre,
        titre: evaluations.titre,
        date: evaluations.date,
      })
      .from(notes)
      .innerJoin(inscriptions, eq(inscriptions.id, notes.inscriptionId))
      .innerJoin(evaluations, eq(evaluations.id, notes.evaluationId))
      .where(eq(inscriptions.eleveId, eleveId))
      .orderBy(desc(evaluations.date)),
    [eleveId],
  );

  const parTrimestre = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const t of TRIMESTRES) {
      map.set(t, moyenne((sesNotes ?? []).filter((n) => n.trimestre === t)));
    }
    return map;
  }, [sesNotes]);

  const generale = useMemo(() => moyenne(sesNotes ?? []), [sesNotes]);

  if (!sesNotes || sesNotes.length === 0) return null;

  return (
    <View style={[styles.bloc, { backgroundColor: c.backgroundElement }]}>
      <View style={styles.enTete}>
        <View style={{ gap: Spacing.half }}>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            Moyenne générale
          </ThemedText>
          <ThemedText style={styles.generale}>
            {formatMoyenne(generale)}
            <ThemedText type="small" style={{ color: c.textSecondary }}> / 20</ThemedText>
          </ThemedText>
        </View>

        <View style={styles.trimestres}>
          {TRIMESTRES.map((t) => (
            <View key={t} style={styles.trimestre}>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                T{t}
              </ThemedText>
              <ThemedText style={styles.valeurTrimestre}>
                {formatMoyenne(parTrimestre.get(t) ?? null)}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      {sesNotes.map((n, i) => (
        <View key={i} style={styles.ligne}>
          <View style={{ flex: 1, gap: Spacing.half }}>
            <ThemedText type="small">{n.titre}</ThemedText>
            <ThemedText type="small" style={{ color: c.textSecondary }}>
              {formatJourCourt(n.date)} · coef {n.coef}
            </ThemedText>
          </View>
          <ThemedText style={styles.note}>
            {n.absent ? (
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                Abs
              </ThemedText>
            ) : (
              <>
                {String(n.valeur).replace('.', ',')}
                <ThemedText type="small" style={{ color: c.textSecondary }}>
                  {' '}
                  /{n.bareme}
                </ThemedText>
              </>
            )}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: {
    borderRadius: Radius.m,
    padding: Spacing.three,
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    ...CardShadow,
  },
  enTete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  generale: { fontSize: 30, fontWeight: '700' },
  trimestres: { flexDirection: 'row', gap: Spacing.three },
  trimestre: { alignItems: 'center', gap: Spacing.half },
  valeurTrimestre: { fontSize: 15, fontWeight: '700' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  note: { fontSize: 17, fontWeight: '700' },
});

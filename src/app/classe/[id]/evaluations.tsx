import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuActions } from '@/components/menu-actions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { aujourdhui } from '@/constants/observations';
import { Colors, Spacing } from '@/constants/theme';
import { db } from '@/db';
import { creerEvaluation, supprimerEvaluation } from '@/db/evaluations';
import { classes, evaluations, inscriptions, notes } from '@/db/schema';
import { formatJourCourt } from '@/lib/calendrier';
import { formatMoyenne, moyenne, moyenneClasse } from '@/lib/moyennes';
import { TRIMESTRES, trimestreDeDate } from '@/lib/trimestre';

export default function EcranEvaluations() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classeId = Number(id);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  const [trimestre, setTrimestre] = useState(trimestreDeDate());
  const [modalVisible, setModalVisible] = useState(false);
  const [titre, setTitre] = useState('');
  const [bareme, setBareme] = useState('20');
  const [coef, setCoef] = useState('1');

  const { data: infosClasse } = useLiveQuery(
    db.select().from(classes).where(eq(classes.id, classeId)),
    [classeId],
  );
  const classe = infosClasse?.[0];

  const { data: evals } = useLiveQuery(
    db
      .select()
      .from(evaluations)
      .where(eq(evaluations.classeId, classeId))
      .orderBy(desc(evaluations.date)),
    [classeId],
  );

  // toutes les notes de la classe : sert aux moyennes par évaluation et à la
  // moyenne générale de la classe sur le trimestre
  const { data: toutesNotes } = useLiveQuery(
    db
      .select({
        evaluationId: notes.evaluationId,
        inscriptionId: notes.inscriptionId,
        valeur: notes.valeur,
        absent: notes.absent,
        bareme: evaluations.bareme,
        coef: evaluations.coef,
        trimestre: evaluations.trimestre,
      })
      .from(notes)
      .innerJoin(evaluations, eq(evaluations.id, notes.evaluationId))
      .where(eq(evaluations.classeId, classeId)),
    [classeId],
  );

  const { data: eleves } = useLiveQuery(
    db
      .select({ inscriptionId: inscriptions.id })
      .from(inscriptions)
      .where(eq(inscriptions.classeId, classeId)),
    [classeId],
  );

  const evalsDuTrimestre = (evals ?? []).filter((e) => e.trimestre === trimestre);

  /** moyenne de la classe pour une évaluation donnée */
  const moyenneParEval = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const e of evals ?? []) {
      const lignes = (toutesNotes ?? []).filter((n) => n.evaluationId === e.id);
      map.set(
        e.id,
        moyenneClasse(lignes.map((n) => moyenne([{ ...n, coef: 1 }]))),
      );
    }
    return map;
  }, [evals, toutesNotes]);

  /** moyenne générale de la classe sur le trimestre affiché */
  const moyenneGenerale = useMemo(() => {
    const parEleve = (eleves ?? []).map((el) =>
      moyenne(
        (toutesNotes ?? [])
          .filter((n) => n.inscriptionId === el.inscriptionId && n.trimestre === trimestre)
          .map((n) => ({ valeur: n.valeur, absent: n.absent, bareme: n.bareme, coef: n.coef })),
      ),
    );
    return moyenneClasse(parEleve);
  }, [eleves, toutesNotes, trimestre]);

  async function creer() {
    const t = titre.trim();
    const b = Number(bareme.replace(',', '.'));
    const k = Number(coef.replace(',', '.'));
    if (!t) return;
    if (!Number.isFinite(b) || b <= 0) {
      Alert.alert('Barème invalide', 'Le barème doit être un nombre supérieur à 0.');
      return;
    }
    if (!Number.isFinite(k) || k <= 0) {
      Alert.alert('Coefficient invalide', 'Le coefficient doit être un nombre supérieur à 0.');
      return;
    }

    const nouvelId = await creerEvaluation({
      classeId,
      titre: t,
      date: aujourdhui(),
      trimestre,
      bareme: b,
      coef: k,
    });
    setTitre('');
    setBareme('20');
    setCoef('1');
    setModalVisible(false);
    router.push({ pathname: '/evaluation/[id]', params: { id: String(nouvelId) } });
  }

  function confirmerSuppression(evalId: number, titreEval: string) {
    Alert.alert(`Supprimer « ${titreEval} » ?`, 'Toutes les notes de cette évaluation seront perdues.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => supprimerEvaluation(evalId) },
    ]);
  }

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen
        options={{
          title: classe ? `Notes — ${classe.nom}` : 'Notes',
          headerRight: () => (
            <MenuActions
              actions={[{ label: 'Nouvelle évaluation', onPress: () => setModalVisible(true) }]}
            />
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.liste, { paddingBottom: Spacing.six + insets.bottom }]}>
        <View style={styles.onglets}>
          {TRIMESTRES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setTrimestre(t)}
              style={[
                styles.onglet,
                {
                  backgroundColor: t === trimestre ? c.text : c.backgroundElement,
                },
              ]}>
              <ThemedText
                style={{ color: t === trimestre ? c.background : c.textSecondary, fontWeight: '600' }}>
                T{t}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={[styles.bandeau, { backgroundColor: c.backgroundElement }]}>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            Moyenne de la classe — T{trimestre}
          </ThemedText>
          <ThemedText style={styles.moyenneGenerale}>
            {formatMoyenne(moyenneGenerale)}
            <ThemedText type="small" style={{ color: c.textSecondary }}> / 20</ThemedText>
          </ThemedText>
        </View>

        {evalsDuTrimestre.length === 0 ? (
          <ThemedText style={[styles.vide, { color: c.textSecondary }]}>
            Aucune évaluation au trimestre {trimestre}.{'\n'}Menu ⋯ pour en créer une.
          </ThemedText>
        ) : (
          evalsDuTrimestre.map((e) => {
            const saisies = (toutesNotes ?? []).filter((n) => n.evaluationId === e.id).length;
            const total = eleves?.length ?? 0;
            return (
              <Pressable
                key={e.id}
                onPress={() =>
                  router.push({ pathname: '/evaluation/[id]', params: { id: String(e.id) } })
                }
                onLongPress={() => confirmerSuppression(e.id, e.titre)}
                style={({ pressed }) => [
                  styles.carte,
                  { backgroundColor: pressed ? c.backgroundSelected : c.backgroundElement },
                ]}>
                <View style={{ flex: 1, gap: Spacing.half }}>
                  <ThemedText style={styles.titreEval}>{e.titre}</ThemedText>
                  <ThemedText type="small" style={{ color: c.textSecondary }}>
                    {formatJourCourt(e.date)} · /{e.bareme} · coef {e.coef} · {saisies}/{total} saisies
                  </ThemedText>
                </View>
                <ThemedText style={styles.moyenneEval}>
                  {formatMoyenne(moyenneParEval.get(e.id) ?? null)}
                </ThemedText>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <Pressable style={styles.fond} onPress={() => setModalVisible(false)} />
        <ThemedView
          type="backgroundElement"
          style={[styles.feuille, { paddingBottom: Spacing.five + insets.bottom }]}>
          <ThemedText type="subtitle">Nouvelle évaluation</ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            Trimestre {trimestre} · {formatJourCourt(aujourdhui())}
          </ThemedText>

          <TextInput
            value={titre}
            onChangeText={setTitre}
            placeholder="Contrôle — Théorème de Pythagore"
            placeholderTextColor={c.textSecondary}
            autoFocus
            style={[styles.champ, { color: c.text, borderColor: c.backgroundSelected }]}
          />

          <View style={styles.ligneChamps}>
            <View style={{ flex: 1, gap: Spacing.one }}>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                Barème
              </ThemedText>
              <TextInput
                value={bareme}
                onChangeText={setBareme}
                keyboardType="numeric"
                style={[styles.champ, { color: c.text, borderColor: c.backgroundSelected }]}
              />
            </View>
            <View style={{ flex: 1, gap: Spacing.one }}>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                Coefficient
              </ThemedText>
              <TextInput
                value={coef}
                onChangeText={setCoef}
                keyboardType="numeric"
                style={[styles.champ, { color: c.text, borderColor: c.backgroundSelected }]}
              />
            </View>
          </View>

          <Pressable
            onPress={creer}
            disabled={!titre.trim()}
            style={[styles.bouton, { backgroundColor: c.text, opacity: titre.trim() ? 1 : 0.4 }]}>
            <ThemedText style={[styles.titreEval, { color: c.background }]}>
              Créer et saisir les notes
            </ThemedText>
          </Pressable>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  liste: { padding: Spacing.three, gap: Spacing.two },
  onglets: { flexDirection: 'row', gap: Spacing.two },
  onglet: { flex: 1, paddingVertical: Spacing.two, borderRadius: Spacing.two, alignItems: 'center' },
  bandeau: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
    marginBottom: Spacing.two,
  },
  moyenneGenerale: { fontSize: 32, fontWeight: '700' },
  vide: { textAlign: 'center', marginTop: Spacing.six },
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  titreEval: { fontSize: 16, fontWeight: '600' },
  moyenneEval: { fontSize: 20, fontWeight: '700' },
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  feuille: {
    padding: Spacing.four,
    gap: Spacing.three,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  ligneChamps: { flexDirection: 'row', gap: Spacing.three },
  champ: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, fontSize: 16 },
  bouton: { padding: Spacing.three, borderRadius: Spacing.two, alignItems: 'center' },
});

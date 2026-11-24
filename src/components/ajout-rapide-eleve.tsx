import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, useColorScheme, View } from 'react-native';

import { ModaleCentree } from '@/components/modale-centree';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { OBSERVATIONS } from '@/constants/observations';
import { RATTRAPAGE_EVAL, SUIVIS } from '@/constants/suivis';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { marquerAbsentsRattrapage } from '@/db/evaluations';
import { enregistrerObservations } from '@/db/observations';
import { creerSuivisEnMasse } from '@/db/suivis';
import type { TypeObservation, TypeSuivi } from '@/db/schema';

type EleveChoix = { inscriptionId: number; nom: string; prenom: string };
type EvalChoix = { id: number; titre: string; date: string };

/**
 * Saisie rapide ponctuelle depuis la page séance : on choisit UNE action — une
 * observation (le fait du jour, daté) OU un « à vérifier » (suivi) — puis on
 * coche un ou plusieurs élèves. Réutilise `ModaleCentree` et les métadonnées
 * `OBSERVATIONS`/`SUIVIS`. L'« exo à rattraper » n'est pas proposé ici : il naît
 * automatiquement d'un « exo non fait ».
 */
type Action =
  | { kind: 'obs'; type: TypeObservation; couleur: string }
  | { kind: 'suivi'; type: TypeSuivi; couleur: string }
  | { kind: 'ds'; evaluationId: number; couleur: string };

const SUIVIS_MANUELS = SUIVIS.filter((s) => s.type !== 'exo');

/** "YYYY-MM-DD" → "12/11". */
function jourMois(iso: string): string {
  const [, m, j] = iso.split('-');
  return `${j}/${m}`;
}

export function AjoutRapideEleve({
  visible,
  onClose,
  eleves,
  evaluations = [],
}: {
  visible: boolean;
  onClose: () => void;
  eleves: EleveChoix[];
  evaluations?: EvalChoix[];
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];

  const [action, setAction] = useState<Action | null>(null);
  const [libelle, setLibelle] = useState('');
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [recherche, setRecherche] = useState('');

  const filtres = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase('fr-FR');
    if (!q) return eleves;
    return eleves.filter((e) => `${e.prenom} ${e.nom}`.toLocaleLowerCase('fr-FR').includes(q));
  }, [eleves, recherche]);

  function reset() {
    setAction(null);
    setLibelle('');
    setSelection(new Set());
    setRecherche('');
  }
  function fermer() {
    reset();
    onClose();
  }
  function basculer(inscriptionId: number) {
    setSelection((p) => {
      const s = new Set(p);
      if (s.has(inscriptionId)) s.delete(inscriptionId);
      else s.add(inscriptionId);
      return s;
    });
  }

  async function valider() {
    const ids = [...selection];
    if (!action || ids.length === 0) return;
    if (action.kind === 'obs') await enregistrerObservations(ids, action.type);
    else if (action.kind === 'suivi') await creerSuivisEnMasse(ids, action.type, libelle);
    else await marquerAbsentsRattrapage(action.evaluationId, ids);
    fermer();
  }

  const couleurActive = action?.couleur ?? c.accent;

  return (
    <ModaleCentree
      visible={visible}
      onClose={fermer}
      footer={
        <PressableScale
          onPress={valider}
          disabled={!action || selection.size === 0}
          style={[styles.valider, { backgroundColor: couleurActive, opacity: !action || selection.size === 0 ? 0.4 : 1 }]}>
          <ThemedText style={{ color: '#fff', fontWeight: '700' }}>
            {!action
              ? 'Choisis une action'
              : selection.size === 0
                ? 'Sélectionne des élèves'
                : `Valider · ${selection.size} élève${selection.size > 1 ? 's' : ''}`}
          </ThemedText>
        </PressableScale>
      }>
      <ThemedText type="subtitle">Saisie rapide</ThemedText>

      <ThemedText style={styles.groupeLabel}>Noté aujourd’hui</ThemedText>
      <View style={styles.pills}>
        {OBSERVATIONS.map((o) => {
          const actif = action?.kind === 'obs' && action.type === o.type;
          return (
            <Pressable
              key={o.type}
              onPress={() => setAction({ kind: 'obs', type: o.type, couleur: o.couleur })}
              style={[styles.pill, { borderColor: actif ? o.couleur : c.border, backgroundColor: actif ? o.couleur : 'transparent' }]}>
              <ThemedText type="small" style={{ color: actif ? '#fff' : c.text, fontWeight: '700' }}>
                {o.emoji} {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText style={styles.groupeLabel}>À vérifier plus tard</ThemedText>
      <View style={styles.pills}>
        {SUIVIS_MANUELS.map((s) => {
          const actif = action?.kind === 'suivi' && action.type === s.type;
          return (
            <Pressable
              key={s.type}
              onPress={() => setAction({ kind: 'suivi', type: s.type, couleur: s.couleur })}
              style={[styles.pill, { borderColor: actif ? s.couleur : c.border, backgroundColor: actif ? s.couleur : 'transparent' }]}>
              <ThemedText type="small" style={{ color: actif ? '#fff' : c.text, fontWeight: '700' }}>
                {s.emoji} {s.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {action?.kind === 'suivi' && (
        <TextInput
          value={libelle}
          onChangeText={setLibelle}
          placeholder="Précision (optionnel) : cours du 12/11…"
          placeholderTextColor={c.textSecondary}
          style={[styles.champ, { color: c.text, borderColor: c.border }]}
        />
      )}

      {evaluations.length > 0 && (
        <>
          <ThemedText style={styles.groupeLabel}>Rattrapage de DS (marquer absent)</ThemedText>
          <View style={styles.pills}>
            {evaluations.map((ev) => {
              const actif = action?.kind === 'ds' && action.evaluationId === ev.id;
              return (
                <Pressable
                  key={ev.id}
                  onPress={() => setAction({ kind: 'ds', evaluationId: ev.id, couleur: RATTRAPAGE_EVAL.couleur })}
                  style={[
                    styles.pill,
                    {
                      borderColor: actif ? RATTRAPAGE_EVAL.couleur : c.border,
                      backgroundColor: actif ? RATTRAPAGE_EVAL.couleur : 'transparent',
                    },
                  ]}>
                  <ThemedText type="small" style={{ color: actif ? '#fff' : c.text, fontWeight: '700' }}>
                    {RATTRAPAGE_EVAL.emoji} {ev.titre} · {jourMois(ev.date)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <TextInput
        value={recherche}
        onChangeText={setRecherche}
        placeholder="Chercher un élève…"
        placeholderTextColor={c.textSecondary}
        style={[styles.champ, { color: c.text, borderColor: c.border }]}
      />

      <View style={{ gap: Spacing.one }}>
        {filtres.length === 0 ? (
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            Aucun élève.
          </ThemedText>
        ) : (
          filtres.map((e) => {
            const choisi = selection.has(e.inscriptionId);
            return (
              <Pressable
                key={e.inscriptionId}
                onPress={() => basculer(e.inscriptionId)}
                style={[
                  styles.eleve,
                  { backgroundColor: choisi ? couleurActive : c.backgroundElement, borderColor: c.border },
                ]}>
                <View style={[styles.case, { borderColor: choisi ? '#fff' : c.textSecondary }]}>
                  {choisi && <ThemedText style={styles.coche}>✓</ThemedText>}
                </View>
                <ThemedText style={{ color: choisi ? '#fff' : c.text, fontWeight: '600' }} numberOfLines={1}>
                  {e.nom.toLocaleUpperCase('fr-FR')} {e.prenom}
                </ThemedText>
              </Pressable>
            );
          })
        )}
      </View>
    </ModaleCentree>
  );
}

const styles = StyleSheet.create({
  groupeLabel: { fontSize: 13, fontWeight: '700', marginTop: Spacing.one, opacity: 0.8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, borderWidth: 1 },
  champ: { borderWidth: 1, borderRadius: Radius.s, padding: Spacing.three, fontSize: 16 },
  eleve: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 48,
    borderRadius: Radius.s,
    borderWidth: StyleSheet.hairlineWidth,
  },
  case: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coche: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  valider: { padding: Spacing.three, borderRadius: Radius.s, alignItems: 'center', marginTop: Spacing.one },
});

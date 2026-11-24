import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AjoutRapideEleve } from '@/components/ajout-rapide-eleve';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RATTRAPAGE_EVAL, SUIVIS, infosSuivi } from '@/constants/suivis';
import { aujourdhui } from '@/constants/observations';
import { CardShadow, Colors, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useAnneeActive } from '@/hooks/use-annee-active';
import { bornesTrimestre, trimestreDeDate } from '@/lib/trimestre';
import { db } from '@/db';
import { creerColle } from '@/db/colles';
import { selectElevesOrdonnes } from '@/db/eleves';
import { selectCompteursCollables } from '@/db/observations';
import {
  definirRattrapageAbandonne,
  selectEvaluationsClasse,
  selectRattrapagesClasse,
} from '@/db/evaluations';
import {
  definirDernierAvertissement,
  reglerSuivi,
  rouvrirSuivi,
  selectSuivisOuvertsClasse,
} from '@/db/suivis';
import { classes, type TypeSuivi } from '@/db/schema';

/** "YYYY-MM-DD" → "12/11" (contexte « depuis le… »). */
function jourMois(iso: string): string {
  const [, m, j] = iso.split('-');
  return `${j}/${m}`;
}

type SuiviRow = {
  id: number;
  inscriptionId: number;
  type: TypeSuivi;
  libelle: string | null;
  dernierAvertissement: boolean;
  ouvertLe: string;
};
type RattrapageRow = {
  inscriptionId: number;
  evaluationId: number;
  titre: string;
  date: string;
};
type Compteurs = { exo: number; oubli: number };
type Ligne = {
  key: string;
  nom: string;
  detail: string;
  barre: boolean;
  alerte?: boolean;
  compteurs?: Compteurs;
  actions: Action[];
};
type Action = { libelle: string; onPress: () => void; actif?: boolean };

/** à partir de combien d'occurrences le compteur passe en rouge (« à coller ») */
const SEUIL_COLLE = 3;

export default function EcranSeance() {
  const { id, groupe } = useLocalSearchParams<{ id: string; groupe?: string }>();
  const classeId = Number(id);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  // demi-groupe de l'heure tapée : on ne tient compte que des présents
  const filtreGroupe: 0 | 1 | 2 = groupe === 'g1' ? 1 : groupe === 'g2' ? 2 : 0;

  const { data: infosClasse } = useLiveQuery(
    db
      .select({ nom: classes.nom, groupe1Nom: classes.groupe1Nom, groupe2Nom: classes.groupe2Nom })
      .from(classes)
      .where(eq(classes.id, classeId)),
    [classeId],
  );
  const classe = infosClasse?.[0];
  const sousTitre =
    filtreGroupe === 0 ? null : filtreGroupe === 1 ? classe?.groupe1Nom : classe?.groupe2Nom;

  const { data: eleves } = useLiveQuery(selectElevesOrdonnes(classeId), [classeId]);
  const { data: suivis } = useLiveQuery(selectSuivisOuvertsClasse(classeId), [classeId]);
  const { data: rattrapages } = useLiveQuery(selectRattrapagesClasse(classeId), [classeId]);
  const { data: evaluationsClasse } = useLiveQuery(selectEvaluationsClasse(classeId), [classeId]);

  // récurrence des faits collables (exo non fait + oublis) sur le trimestre en
  // cours → compteur « 3ᵉ fois » par élève
  const { annee, bornes } = useAnneeActive();
  const trimestre = bornes ? trimestreDeDate(aujourdhui(), bornes) : null;
  const rangeTrim = annee && bornes && trimestre ? bornesTrimestre(trimestre, annee.libelle, bornes) : null;
  const { data: compteursRaw } = useLiveQuery(
    selectCompteursCollables(classeId, rangeTrim?.debut ?? '', rangeTrim?.fin ?? ''),
    [classeId, rangeTrim?.debut, rangeTrim?.fin],
  );
  const compteurs = useMemo(() => {
    const m = new Map<number, Compteurs>();
    for (const r of compteursRaw ?? []) {
      const e = m.get(r.inscriptionId) ?? { exo: 0, oubli: 0 };
      if (r.type === 'exo_non_fait') e.exo = r.n;
      else if (r.type === 'materiel_oublie') e.oubli = r.n;
      m.set(r.inscriptionId, e);
    }
    return m;
  }, [compteursRaw]);

  // clôtures locales : l'item reste barré jusqu'à ce qu'on quitte la page (undo).
  const [suivisClos, setSuivisClos] = useState<Map<number, SuiviRow>>(new Map());
  const [rattrapagesClos, setRattrapagesClos] = useState<Map<string, RattrapageRow>>(new Map());

  const [ajoutVisible, setAjoutVisible] = useState(false);

  // élèves présents (filtrés au demi-groupe) pour la saisie rapide de la modale
  const elevesPresents = useMemo(
    () =>
      (eleves ?? [])
        .filter((e) => filtreGroupe === 0 || e.groupe === filtreGroupe)
        .map((e) => ({ inscriptionId: e.inscriptionId, nom: e.nom, prenom: e.prenom })),
    [eleves, filtreGroupe],
  );

  function reglerLocal(s: SuiviRow) {
    reglerSuivi(s.id);
    setSuivisClos((p) => new Map(p).set(s.id, s));
  }
  function annulerReglage(s: SuiviRow) {
    rouvrirSuivi(s.id);
    setSuivisClos((p) => {
      const m = new Map(p);
      m.delete(s.id);
      return m;
    });
  }
  function abandonnerRattrapage(r: RattrapageRow) {
    definirRattrapageAbandonne(r.evaluationId, r.inscriptionId, true);
    setRattrapagesClos((p) => new Map(p).set(`${r.evaluationId}:${r.inscriptionId}`, r));
  }
  function annulerAbandon(r: RattrapageRow) {
    definirRattrapageAbandonne(r.evaluationId, r.inscriptionId, false);
    setRattrapagesClos((p) => {
      const m = new Map(p);
      m.delete(`${r.evaluationId}:${r.inscriptionId}`);
      return m;
    });
  }
  function basculerAvertissement(s: SuiviRow) {
    definirDernierAvertissement(s.id, !s.dernierAvertissement);
  }
  function escaladerEnColle(s: SuiviRow, nom: string) {
    const info = infosSuivi(s.type);
    const motif = s.libelle ? `${info.label} — ${s.libelle}` : info.label;
    Alert.alert('Créer une colle ?', `${nom} · ${motif}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Créer',
        onPress: async () => {
          await creerColle(s.inscriptionId, null, motif);
          reglerLocal(s);
        },
      },
    ]);
  }

  // nom affichable + appartenance au demi-groupe, par inscription
  const presents = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of eleves ?? []) {
      if (filtreGroupe === 0 || e.groupe === filtreGroupe) {
        map.set(e.inscriptionId, `${e.nom.toLocaleUpperCase('fr-FR')} ${e.prenom}`);
      }
    }
    return map;
  }, [eleves, filtreGroupe]);

  /**
   * Regroupe tout par CATÉGORIE (DS, exo, cahier…), en ne gardant que les
   * élèves présents et les catégories non vides. Les items clôturés localement
   * restent dans leur catégorie, barrés, tant qu'on n'a pas quitté la page.
   */
  const categories = useMemo(() => {
    const suivisOuverts = (suivis ?? []).filter(
      (s) => !suivisClos.has(s.id) && presents.has(s.inscriptionId),
    );
    const rattOuverts = (rattrapages ?? []).filter(
      (r) => !rattrapagesClos.has(`${r.evaluationId}:${r.inscriptionId}`) && presents.has(r.inscriptionId),
    );
    const suivisBarres = [...suivisClos.values()].filter((s) => presents.has(s.inscriptionId));
    const rattBarres = [...rattrapagesClos.values()].filter((r) => presents.has(r.inscriptionId));

    const ligneSuivi = (s: SuiviRow, barre: boolean): Ligne => ({
      key: `s-${s.id}`,
      nom: presents.get(s.inscriptionId) ?? '',
      detail: barre
        ? 'réglé'
        : `${s.dernierAvertissement ? 'Dernier avertissement · ' : ''}${s.libelle ? `${s.libelle} · ` : ''}depuis le ${jourMois(s.ouvertLe)}`,
      barre,
      alerte: !barre && s.dernierAvertissement,
      compteurs: compteurs.get(s.inscriptionId),
      actions: barre
        ? [{ libelle: 'annuler', onPress: () => annulerReglage(s) }]
        : [
            { libelle: 'réglé', onPress: () => reglerLocal(s) },
            { libelle: '⚠', actif: s.dernierAvertissement, onPress: () => basculerAvertissement(s) },
            { libelle: 'coller', onPress: () => escaladerEnColle(s, presents.get(s.inscriptionId) ?? '') },
          ],
    });
    const ligneRatt = (r: RattrapageRow, barre: boolean): Ligne => ({
      key: `r-${r.evaluationId}:${r.inscriptionId}`,
      nom: presents.get(r.inscriptionId) ?? '',
      detail: barre ? 'dispensé' : `${r.titre} · du ${jourMois(r.date)}`,
      barre,
      compteurs: compteurs.get(r.inscriptionId),
      actions: barre
        ? [{ libelle: 'annuler', onPress: () => annulerAbandon(r) }]
        : [
            {
              libelle: '✓ noter',
              onPress: () =>
                router.push({ pathname: '/evaluation/[id]', params: { id: String(r.evaluationId) } }),
            },
            { libelle: '✗ dispensé', onPress: () => abandonnerRattrapage(r) },
          ],
    });

    const blocs: { cle: string; emoji: string; couleur: string; label: string; lignes: Ligne[] }[] = [];

    // DS d'abord (le plus important), puis les types de suivi dans l'ordre défini
    const lignesDs = [
      ...rattOuverts.map((r) => ligneRatt(r, false)),
      ...rattBarres.map((r) => ligneRatt(r, true)),
    ];
    if (lignesDs.length > 0) {
      blocs.push({ cle: 'ds', ...RATTRAPAGE_EVAL, lignes: lignesDs });
    }
    for (const cat of SUIVIS) {
      const lignes = [
        ...suivisOuverts.filter((s) => s.type === cat.type).map((s) => ligneSuivi(s, false)),
        ...suivisBarres.filter((s) => s.type === cat.type).map((s) => ligneSuivi(s, true)),
      ];
      if (lignes.length > 0) {
        blocs.push({ cle: cat.type, emoji: cat.emoji, couleur: cat.couleur, label: cat.label, lignes });
      }
    }
    return blocs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suivis, rattrapages, suivisClos, rattrapagesClos, presents, compteurs]);

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen
        options={{ title: classe?.nom ? `Séance · ${classe.nom}${sousTitre ? ` · ${sousTitre}` : ''}` : 'Séance' }}
      />

      <ScrollView contentContainerStyle={[styles.liste, { paddingBottom: Spacing.six + insets.bottom }]}>
        {categories.length === 0 ? (
          <ThemedText style={[styles.vide, { color: c.textSecondary }]}>
            Rien à vérifier{sousTitre ? ` pour ${sousTitre}` : ''}. ✨
          </ThemedText>
        ) : (
          categories.map((cat) => (
            <View key={cat.cle} style={styles.categorie}>
              <View style={styles.catEntete}>
                <View style={[styles.pastille, { backgroundColor: cat.couleur }]}>
                  <ThemedText style={{ fontSize: 13 }}>{cat.emoji}</ThemedText>
                </View>
                <ThemedText style={styles.catTitre}>{cat.label}</ThemedText>
                <ThemedText type="small" style={{ color: c.textSecondary }}>
                  {cat.lignes.filter((l) => !l.barre).length}
                </ThemedText>
              </View>
              {cat.lignes.map((l) => (
                <LigneSeance key={l.key} c={c} ligne={l} />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Bouton bas-gauche : plan de classe (toute la classe) */}
      <PressableScale
        onPress={() => router.push({ pathname: '/classe/[id]/plan', params: { id: String(classeId) } })}
        style={[styles.plan, { backgroundColor: c.backgroundElement, borderColor: c.border, bottom: Spacing.four + insets.bottom }]}>
        <ThemedText style={{ fontWeight: '700' }}>🪑 Plan</ThemedText>
      </PressableScale>

      {/* FAB unique : saisie rapide (observations + à vérifier) sur un ou
          plusieurs élèves présents */}
      <PressableScale
        onPress={() => setAjoutVisible(true)}
        style={[styles.fab, { backgroundColor: c.accent, bottom: Spacing.four + insets.bottom }]}>
        <ThemedText style={styles.fabTexte}>+</ThemedText>
      </PressableScale>

      <AjoutRapideEleve
        visible={ajoutVisible}
        onClose={() => setAjoutVisible(false)}
        eleves={elevesPresents}
        evaluations={evaluationsClasse ?? []}
      />
    </ThemedView>
  );
}

const ALERTE = '#F76B15';
const ROUGE = '#E5484D';

/** Badge de récurrence : nombre d'occurrences ce trimestre, rouge au seuil colle. */
function Compteur({ c, emoji, n }: { c: ThemeColors; emoji: string; n: number }) {
  const chaud = n >= SEUIL_COLLE;
  return (
    <View style={[styles.compteur, { backgroundColor: chaud ? ROUGE : c.backgroundSelected }]}>
      <ThemedText style={{ fontSize: 12 }}>{emoji}</ThemedText>
      <ThemedText style={{ fontSize: 13, fontWeight: '800', color: chaud ? '#fff' : c.text }}>{n}</ThemedText>
    </View>
  );
}

/** Une ligne élève dans une catégorie : nom + détail + actions. */
function LigneSeance({ c, ligne }: { c: ThemeColors; ligne: Ligne }) {
  return (
    <View
      style={[
        styles.ligne,
        {
          backgroundColor: c.backgroundElement,
          borderColor: ligne.alerte ? ALERTE : c.border,
          borderWidth: ligne.alerte ? 1 : StyleSheet.hairlineWidth,
          opacity: ligne.barre ? 0.5 : 1,
        },
      ]}>
      <View style={styles.enteteLigne}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[{ fontWeight: '700', fontSize: 15 }, ligne.barre && styles.barre]} numberOfLines={1}>
            {ligne.alerte ? '⚠ ' : ''}
            {ligne.nom}
          </ThemedText>
          <ThemedText type="small" style={{ color: ligne.alerte ? ALERTE : c.textSecondary }} numberOfLines={2}>
            {ligne.detail}
          </ThemedText>
        </View>
        {ligne.compteurs && (
          <View style={styles.compteurs}>
            {ligne.compteurs.exo > 0 && <Compteur c={c} emoji="📕" n={ligne.compteurs.exo} />}
            {ligne.compteurs.oubli > 0 && <Compteur c={c} emoji="🎒" n={ligne.compteurs.oubli} />}
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {ligne.actions.map((a) => (
          <Pressable
            key={a.libelle}
            onPress={a.onPress}
            hitSlop={6}
            style={[
              styles.action,
              { borderColor: a.actif ? ALERTE : c.border, backgroundColor: a.actif ? ALERTE : 'transparent' },
            ]}>
            <ThemedText style={{ color: a.actif ? '#fff' : c.text, fontWeight: '700', fontSize: 15 }}>
              {a.libelle}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  liste: { padding: Spacing.three, gap: Spacing.four },
  vide: { textAlign: 'center', marginTop: Spacing.six, lineHeight: 22 },
  categorie: { gap: Spacing.two },
  catEntete: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  catTitre: { fontSize: 16, fontWeight: '800', flex: 1 },
  pastille: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  barre: { textDecorationLine: 'line-through' },
  ligne: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.s,
    borderWidth: StyleSheet.hairlineWidth,
  },
  enteteLigne: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  compteurs: { flexDirection: 'row', gap: Spacing.one },
  compteur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.s,
    borderWidth: 1,
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...CardShadow,
  },
  fabTexte: { color: '#fff', fontSize: 32, fontWeight: '300', lineHeight: 36, marginTop: -2 },
  plan: {
    position: 'absolute',
    left: Spacing.four,
    paddingHorizontal: Spacing.four,
    height: 48,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...CardShadow,
  },
});

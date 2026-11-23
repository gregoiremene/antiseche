import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GrilleEdt, JOURS, type BlocEdt } from '@/components/grille-edt';
import { ModaleCentree } from '@/components/modale-centree';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PALETTE, texteSurCouleur } from '@/constants/couleurs';
import { Colors, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { db } from '@/db';
import {
  ajouterCours,
  getOuCreerParametresEdt,
  majAncreEdt,
  majCours,
  selectEdtClasse,
  supprimerCours,
  type CoursEdt,
} from '@/db/edt';
import { libelleGroupeCompact } from '@/db/groupes';
import { creerMatiere, selectMatieres } from '@/db/matieres';
import { classes, GROUPES_EDT, SEMAINES_EDT, type GroupeEdt, type SemaineEdt } from '@/db/schema';
import { aujourdhuiISO } from '@/lib/calendrier';
import {
  autre,
  construireHeure,
  formatHeure,
  lundiDeLaSemaine,
  typeSemaine,
  type AncreSemaine,
} from '@/lib/semaine-ab';

/** jour d'aujourd'hui ramené à 1–6 ; le dimanche retombe sur lundi */
function jourParDefaut(): number {
  const j = new Date().getDay(); // 0=dim … 6=sam
  return j === 0 || j === 7 ? 1 : j;
}

/** libellé + couleur d'affichage d'un cours (matière gérée, sinon repli). */
function infosCours(co: CoursEdt): { nom: string; couleur: string | null } {
  return {
    nom: co.matiereNom ?? co.matiereLibre ?? 'Cours',
    couleur: co.matiereCouleur ?? null,
  };
}

type Params = { id: number; ancreLundi: string; ancreType: 'A' | 'B' };

export default function EditeurEdt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classeId = Number(id);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const jourJ = aujourdhuiISO();

  const [params, setParams] = useState<Params | null>(null);

  // filtre de vue de la grille : tout l'EDT, ou seulement un demi-groupe
  const [vueGroupe, setVueGroupe] = useState<'tout' | 'g1' | 'g2'>('tout');

  // édition en cours : un cours existant, ou null quand on ajoute
  const [edition, setEdition] = useState<CoursEdt | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // formulaire
  const [hDebut, setHDebut] = useState('');
  const [mDebut, setMDebut] = useState('');
  const [hFin, setHFin] = useState('');
  const [mFin, setMFin] = useState('');
  const [semaine, setSemaine] = useState<SemaineEdt>('toutes');
  const [groupe, setGroupe] = useState<GroupeEdt>('classe');
  const [estMonCours, setEstMonCours] = useState(false);
  const [matiereId, setMatiereId] = useState<number | null>(null);
  const [salle, setSalle] = useState('');
  const [joursAjout, setJoursAjout] = useState<Set<number>>(new Set());

  // création rapide de matière depuis le sélecteur
  const [ajoutMatiere, setAjoutMatiere] = useState(false);
  const [nomNouvelle, setNomNouvelle] = useState('');
  const [couleurNouvelle, setCouleurNouvelle] = useState<string>(PALETTE[0]);

  // saut de champ auto : dès 2 chiffres, on passe au suivant (HH→MM→HH fin…)
  const hDebutRef = useRef<TextInput | null>(null);
  const mDebutRef = useRef<TextInput | null>(null);
  const hFinRef = useRef<TextInput | null>(null);
  const mFinRef = useRef<TextInput | null>(null);

  useEffect(() => {
    getOuCreerParametresEdt().then(setParams);
  }, []);

  const { data: infosClasse } = useLiveQuery(
    db
      .select({ nom: classes.nom, groupe1Nom: classes.groupe1Nom, groupe2Nom: classes.groupe2Nom })
      .from(classes)
      .where(eq(classes.id, classeId)),
    [classeId],
  );
  const nomClasse = infosClasse?.[0]?.nom;
  const g1Nom = infosClasse?.[0]?.groupe1Nom ?? 'Groupe 1';
  const g2Nom = infosClasse?.[0]?.groupe2Nom ?? 'Groupe 2';

  const { data: cours } = useLiveQuery(selectEdtClasse(classeId), [classeId]);

  // la grille n'affiche que les cours concernés par la vue : « Tout » = tout
  // l'EDT ; un groupe = cours de toute la classe + ceux de ce groupe-là.
  const coursAffiches = useMemo(() => {
    const liste = cours ?? [];
    if (vueGroupe === 'tout') return liste;
    return liste.filter((co) => co.groupe === 'classe' || co.groupe === vueGroupe);
  }, [cours, vueGroupe]);

  // cours → blocs pour la grille partagée (titre = matière, badge = groupe)
  const blocs: BlocEdt[] = useMemo(
    () =>
      coursAffiches.map((co) => {
        const info = infosCours(co);
        return {
          id: co.id,
          jour: co.jour,
          heureDebut: co.heureDebut,
          heureFin: co.heureFin,
          semaine: co.semaine,
          couleur: info.couleur,
          titre: info.nom,
          salle: co.salle,
          badge: libelleGroupeCompact(co.groupe, g1Nom, g2Nom),
          monCours: co.estMonCours,
        };
      }),
    [coursAffiches, g1Nom, g2Nom],
  );
  const { data: matieresListe } = useLiveQuery(selectMatieres());

  const ancre: AncreSemaine | null = params
    ? { ancreLundi: params.ancreLundi, ancreType: params.ancreType }
    : null;
  const typeCetteSemaine = ancre ? typeSemaine(jourJ, ancre) : null;

  async function basculerTypeSemaine() {
    if (!params || !typeCetteSemaine) return;
    const lundi = lundiDeLaSemaine(jourJ);
    const nouveau = autre(typeCetteSemaine);
    await majAncreEdt(params.id, lundi, nouveau);
    setParams({ ...params, ancreLundi: lundi, ancreType: nouveau });
  }

  function ouvrirAjout() {
    setEdition(null);
    setHDebut('');
    setMDebut('');
    setHFin('');
    setMFin('');
    setSemaine('toutes');
    setGroupe('classe');
    setEstMonCours(false);
    setMatiereId(null);
    setSalle('');
    setJoursAjout(new Set([jourParDefaut()]));
    setAjoutMatiere(false);
    setModalVisible(true);
  }

  function ouvrirEdition(co: CoursEdt) {
    setEdition(co);
    const [h1, m1] = co.heureDebut.split(':');
    const [h2, m2] = co.heureFin.split(':');
    setHDebut(String(Number(h1)));
    setMDebut(m1);
    setHFin(String(Number(h2)));
    setMFin(m2);
    setSemaine(co.semaine);
    setGroupe(co.groupe);
    setEstMonCours(co.estMonCours);
    setMatiereId(co.matiereId);
    setSalle(co.salle ?? '');
    setAjoutMatiere(false);
    setModalVisible(true);
  }

  async function enregistrer() {
    const debut = construireHeure(Number(hDebut), mDebut === '' ? 0 : Number(mDebut));
    const fin = construireHeure(Number(hFin), mFin === '' ? 0 : Number(mFin));
    if (hDebut === '' || hFin === '' || !debut || !fin) {
      Alert.alert('Horaire invalide', 'Vérifie les heures (0–23) et minutes (0–59).');
      return;
    }
    if (fin <= debut) {
      Alert.alert('Horaire incohérent', 'La fin doit être après le début.');
      return;
    }
    const champs = {
      heureDebut: debut,
      heureFin: fin,
      semaine,
      groupe,
      estMonCours,
      matiereId,
      salle: salle.trim() || null,
    };

    if (edition) {
      await majCours(edition.id, { jour: edition.jour, ...champs });
    } else {
      if (joursAjout.size === 0) {
        Alert.alert('Aucun jour', 'Choisis au moins un jour pour ce cours.');
        return;
      }
      await ajouterCours(classeId, [...joursAjout], champs);
    }
    setModalVisible(false);
  }

  async function creerMatiereRapide() {
    const nom = nomNouvelle.trim();
    if (!nom) return;
    try {
      const nouvelId = await creerMatiere(nom, couleurNouvelle);
      setMatiereId(nouvelId);
      setNomNouvelle('');
      setAjoutMatiere(false);
    } catch {
      Alert.alert('Matière déjà existante', `« ${nom} » existe déjà.`);
    }
  }

  function confirmerSuppression(co: CoursEdt) {
    Alert.alert(
      'Supprimer ce cours ?',
      `${formatHeure(co.heureDebut)}–${formatHeure(co.heureFin)} · ${infosCours(co).nom}`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => supprimerCours(co.id) },
      ],
    );
  }

  function basculerJourAjout(num: number) {
    setJoursAjout((prec) => {
      const suivant = new Set(prec);
      if (suivant.has(num)) suivant.delete(num);
      else suivant.add(num);
      return suivant;
    });
  }

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen options={{ title: nomClasse ? `EDT · ${nomClasse}` : 'Emploi du temps' }} />

      {/* En-tête fixe : ancre A/B + bascule de vue + ajout */}
      <View style={styles.entete}>
        {/* <View style={[styles.carteAb, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
          <View style={{ flex: 1 }}>
            <ThemedText type="small" style={{ color: c.textSecondary }}>
              Alternance A/B
            </ThemedText>
            <ThemedText style={styles.abTexte}>
              Cette semaine : <ThemedText style={{ fontWeight: '800' }}>{typeCetteSemaine ?? '…'}</ThemedText>
            </ThemedText>
          </View>
          {typeCetteSemaine && (
            <PressableScale onPress={basculerTypeSemaine} style={[styles.abBouton, { borderColor: c.border }]}>
              <ThemedText type="small">C’est plutôt {autre(typeCetteSemaine)} ↺</ThemedText>
            </PressableScale>
          )}
        </View> */}

        <View style={styles.barreOutils}>
          <ThemedText type="small" style={{ color: c.textSecondary, flex: 1 }}>
            Chaque jour est coupé en deux : semaine A (gauche) · B (droite).
          </ThemedText>
          <PressableScale onPress={ouvrirAjout} style={[styles.ajoutHaut, { backgroundColor: c.accent }]}>
            <ThemedText style={{ color: c.accentText, fontWeight: '700' }}>+ Cours</ThemedText>
          </PressableScale>
        </View>

        {/* Filtre de vue : tout l'EDT, ou seulement un demi-groupe */}
        <View style={styles.pillsLigne}>
          {([
            { v: 'tout', label: 'Tout' },
            { v: 'g1', label: g1Nom },
            { v: 'g2', label: g2Nom },
          ] as const).map((opt) => {
            const actif = vueGroupe === opt.v;
            return (
              <Pressable
                key={opt.v}
                onPress={() => setVueGroupe(opt.v)}
                style={[
                  styles.choixPill,
                  { borderColor: actif ? c.accent : c.border, backgroundColor: actif ? c.accent : 'transparent' },
                ]}>
                <ThemedText type="small" style={{ color: actif ? c.accentText : c.text, fontWeight: '700' }}>
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <GrilleEdt
        c={c}
        blocs={blocs}
        jours={JOURS.slice()}
        montrerEntete
        insetBottom={insets.bottom}
        vide={`Aucun cours.\nAjoute l’emploi du temps complet de la classe (toutes matières) pour que les créneaux de colle se calculent tout seuls.`}
        onTap={(id) => {
          const co = coursAffiches.find((x) => x.id === id);
          if (co) ouvrirEdition(co);
        }}
        onLong={(id) => {
          const co = coursAffiches.find((x) => x.id === id);
          if (co) confirmerSuppression(co);
        }}
      />

      <ModaleCentree visible={modalVisible} onClose={() => setModalVisible(false)}>
        <ThemedText type="subtitle">{edition ? 'Modifier le cours' : 'Ajouter un cours'}</ThemedText>

        {/* Jours : multi-sélection à l'ajout, jour figé en édition */}
        {edition ? (
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            {JOURS[edition.jour - 1].long}
          </ThemedText>
        ) : (
          <>
            <ThemedText style={styles.champLabel}>Jours</ThemedText>
            <View style={styles.jours}>
              {JOURS.map((j) => {
                const actif = joursAjout.has(j.num);
                return (
                  <Pressable
                    key={j.num}
                    onPress={() => basculerJourAjout(j.num)}
                    style={[
                      styles.jourPill,
                      { borderColor: actif ? c.accent : c.border, backgroundColor: actif ? c.accent : 'transparent' },
                    ]}>
                    <ThemedText type="small" style={{ color: actif ? c.accentText : c.text, fontWeight: '700' }}>
                      {j.court}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <ThemedText style={styles.champLabel}>Horaire</ThemedText>
        <View style={styles.horaireLigne}>
          <ChampHeure
            h={hDebut}
            m={mDebut}
            setH={setHDebut}
            setM={setMDebut}
            c={c}
            hRef={hDebutRef}
            mRef={mDebutRef}
            suivantRef={hFinRef}
          />
          <ThemedText style={{ color: c.textSecondary }}>→</ThemedText>
          <ChampHeure h={hFin} m={mFin} setH={setHFin} setM={setMFin} c={c} hRef={hFinRef} mRef={mFinRef} />
        </View>

        {/* Matière : choix dans la liste gérée + création rapide */}
        <ThemedText style={styles.champLabel}>Matière</ThemedText>
        <View style={styles.pillsLigne}>
          <Pressable
            onPress={() => setMatiereId(null)}
            style={[
              styles.matPill,
              { borderColor: matiereId === null ? c.text : c.border, backgroundColor: matiereId === null ? c.backgroundSelected : 'transparent' },
            ]}>
            <ThemedText type="small" style={{ color: c.textSecondary, fontWeight: '700' }}>
              Aucune
            </ThemedText>
          </Pressable>
          {matieresListe?.map((mat) => {
            const actif = matiereId === mat.id;
            return (
              <Pressable
                key={mat.id}
                onPress={() => setMatiereId(mat.id)}
                style={[
                  styles.matPill,
                  { borderColor: actif ? mat.couleur : c.border, backgroundColor: actif ? mat.couleur : 'transparent' },
                ]}>
                <View style={[styles.pastilleMat, { backgroundColor: mat.couleur }]} />
                <ThemedText
                  type="small"
                  style={{ color: actif ? texteSurCouleur(mat.couleur) : c.text, fontWeight: '700' }}>
                  {mat.nom}
                </ThemedText>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setAjoutMatiere((v) => !v)} style={[styles.matPill, { borderColor: c.border }]}>
            <ThemedText type="small" style={{ color: c.accent, fontWeight: '700' }}>
              + Nouvelle
            </ThemedText>
          </Pressable>
        </View>

        {ajoutMatiere && (
          <View style={[styles.ajoutMat, { borderColor: c.border }]}>
            <TextInput
              value={nomNouvelle}
              onChangeText={setNomNouvelle}
              placeholder="Nom de la matière"
              placeholderTextColor={c.textSecondary}
              autoFocus
              style={[styles.champ, { color: c.text, borderColor: c.border }]}
            />
            <View style={styles.paletteRow}>
              {PALETTE.map((col) => (
                <Pressable
                  key={col}
                  onPress={() => setCouleurNouvelle(col)}
                  style={[
                    styles.swatch,
                    { backgroundColor: col },
                    couleurNouvelle === col && { borderWidth: 3, borderColor: c.text },
                  ]}
                />
              ))}
            </View>
            <PressableScale
              onPress={creerMatiereRapide}
              disabled={!nomNouvelle.trim()}
              style={[styles.creerMat, { backgroundColor: c.accent, opacity: nomNouvelle.trim() ? 1 : 0.4 }]}>
              <ThemedText style={{ color: c.accentText, fontWeight: '700' }}>Créer la matière</ThemedText>
            </PressableScale>
          </View>
        )}

        <ThemedText style={styles.champLabel}>Semaine</ThemedText>
        <View style={styles.pillsLigne}>
          {SEMAINES_EDT.map((s) => {
            const actif = semaine === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSemaine(s)}
                style={[
                  styles.choixPill,
                  { borderColor: actif ? c.accent : c.border, backgroundColor: actif ? c.accent : 'transparent' },
                ]}>
                <ThemedText type="small" style={{ color: actif ? c.accentText : c.text, fontWeight: '700' }}>
                  {s === 'toutes' ? 'Toutes' : `Semaine ${s}`}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ThemedText style={styles.champLabel}>Groupe</ThemedText>
        <View style={styles.pillsLigne}>
          {GROUPES_EDT.map((gr) => {
            const actif = groupe === gr;
            const label = gr === 'classe' ? 'Classe entière' : gr === 'g1' ? g1Nom : g2Nom;
            return (
              <Pressable
                key={gr}
                onPress={() => setGroupe(gr)}
                style={[
                  styles.choixPill,
                  { borderColor: actif ? c.accent : c.border, backgroundColor: actif ? c.accent : 'transparent' },
                ]}>
                <ThemedText type="small" style={{ color: actif ? c.accentText : c.text, fontWeight: '700' }}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setEstMonCours((v) => !v)}
          style={[
            styles.monCours,
            { borderColor: estMonCours ? c.accent : c.border, backgroundColor: estMonCours ? c.accent : 'transparent' },
          ]}>
          <ThemedText style={{ color: estMonCours ? c.accentText : c.text, fontWeight: '700' }}>
            {estMonCours ? '✓ ' : ''}C’est mon cours
          </ThemedText>
          <ThemedText type="small" style={{ color: estMonCours ? c.accentText : c.textSecondary }}>
            (une heure où je peux recevoir un collé)
          </ThemedText>
        </Pressable>

        <ThemedText style={styles.champLabel}>Salle (option)</ThemedText>
        <TextInput
          value={salle}
          onChangeText={setSalle}
          placeholder="12"
          placeholderTextColor={c.textSecondary}
          style={[styles.champ, { color: c.text, borderColor: c.border }]}
        />

        <PressableScale onPress={enregistrer} style={[styles.enregistrer, { backgroundColor: c.accent }]}>
          <ThemedText style={{ color: c.accentText, fontWeight: '700' }}>
            {edition ? 'Enregistrer' : `Ajouter${joursAjout.size > 1 ? ` (${joursAjout.size} jours)` : ''}`}
          </ThemedText>
        </PressableScale>
      </ModaleCentree>
    </ThemedView>
  );
}

function ChampHeure({
  h,
  m,
  setH,
  setM,
  c,
  hRef,
  mRef,
  suivantRef,
}: {
  h: string;
  m: string;
  setH: (v: string) => void;
  setM: (v: string) => void;
  c: ThemeColors;
  hRef: React.RefObject<TextInput | null>;
  mRef: React.RefObject<TextInput | null>;
  /** champ à focaliser une fois les minutes remplies (les heures de fin) */
  suivantRef?: React.RefObject<TextInput | null>;
}) {
  return (
    <View style={styles.heureBloc}>
      <TextInput
        ref={hRef}
        value={h}
        onChangeText={(v) => {
          setH(v);
          if (v.length === 2) mRef.current?.focus();
        }}
        keyboardType="numeric"
        maxLength={2}
        placeholder="HH"
        placeholderTextColor={c.textSecondary}
        style={[styles.champHeure, { color: c.text, borderColor: c.border }]}
      />
      <ThemedText style={{ color: c.textSecondary }}>h</ThemedText>
      <TextInput
        ref={mRef}
        value={m}
        onChangeText={(v) => {
          setM(v);
          if (v.length === 2) suivantRef?.current?.focus();
        }}
        keyboardType="numeric"
        maxLength={2}
        placeholder="00"
        placeholderTextColor={c.textSecondary}
        style={[styles.champHeure, { color: c.text, borderColor: c.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  entete: { padding: Spacing.three, gap: Spacing.three },
  carteAb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
  },
  abTexte: { fontSize: 16, fontWeight: '600', marginTop: Spacing.half },
  abBouton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, borderWidth: 1 },

  barreOutils: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  ajoutHaut: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, borderRadius: Radius.s },

  jours: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  jourPill: {
    flex: 1,
    minWidth: 44,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.s,
    borderWidth: 1,
  },

  // Modale
  champLabel: { fontSize: 15, fontWeight: '700', marginTop: Spacing.one },
  horaireLigne: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  heureBloc: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flex: 1 },
  champHeure: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.s,
    padding: Spacing.two,
    fontSize: 18,
    textAlign: 'center',
  },
  pillsLigne: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  choixPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  matPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  pastilleMat: { width: 10, height: 10, borderRadius: 5 },
  ajoutMat: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.s,
    borderWidth: 1,
    marginTop: Spacing.one,
  },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  creerMat: { padding: Spacing.two, borderRadius: Radius.s, alignItems: 'center' },
  monCours: {
    padding: Spacing.three,
    borderRadius: Radius.s,
    borderWidth: 1,
    gap: Spacing.half,
    marginTop: Spacing.one,
  },
  champ: { borderWidth: 1, borderRadius: Radius.s, padding: Spacing.three, fontSize: 16 },
  enregistrer: { padding: Spacing.three, borderRadius: Radius.s, alignItems: 'center', marginTop: Spacing.two },
});

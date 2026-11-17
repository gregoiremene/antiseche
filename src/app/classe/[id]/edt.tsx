import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
  type DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { creerMatiere, selectMatieres } from '@/db/matieres';
import { classes, SEMAINES_EDT, type SemaineEdt } from '@/db/schema';
import { aujourdhuiISO } from '@/lib/calendrier';
import {
  autre,
  construireHeure,
  formatHeure,
  heureEnMinutes,
  lundiDeLaSemaine,
  typeSemaine,
  type AncreSemaine,
} from '@/lib/semaine-ab';

const JOURS = [
  { num: 1, court: 'Lun', long: 'Lundi' },
  { num: 2, court: 'Mar', long: 'Mardi' },
  { num: 3, court: 'Mer', long: 'Mercredi' },
  { num: 4, court: 'Jeu', long: 'Jeudi' },
  { num: 5, court: 'Ven', long: 'Vendredi' },
  { num: 6, court: 'Sam', long: 'Samedi' },
] as const;

type Jour = (typeof JOURS)[number];

const PX_PAR_MIN = 1; // 1 min = 1 px → une heure fait 60 px de haut
const GUTTER = 34; // largeur de la colonne des heures
const DEBUT_JOURNEE = 8 * 60; // la grille commence au plus tard à 8h
const FIN_JOURNEE = 18 * 60; // la grille descend au moins jusqu'à 18h

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

/**
 * Position horizontale d'un cours dans sa colonne, selon sa semaine : les cours
 * de toutes les semaines prennent toute la largeur, ceux de A la moitié gauche,
 * ceux de B la moitié droite.
 */
function positionHoriz(semaine: SemaineEdt): { left: DimensionValue; right: DimensionValue } {
  if (semaine === 'A') return { left: 0, right: '50%' };
  if (semaine === 'B') return { left: '50%', right: 0 };
  return { left: 0, right: 0 };
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

  // édition en cours : un cours existant, ou null quand on ajoute
  const [edition, setEdition] = useState<CoursEdt | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // formulaire
  const [hDebut, setHDebut] = useState('');
  const [mDebut, setMDebut] = useState('');
  const [hFin, setHFin] = useState('');
  const [mFin, setMFin] = useState('');
  const [semaine, setSemaine] = useState<SemaineEdt>('toutes');
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
    db.select({ nom: classes.nom }).from(classes).where(eq(classes.id, classeId)),
    [classeId],
  );
  const nomClasse = infosClasse?.[0]?.nom;

  const { data: cours } = useLiveQuery(selectEdtClasse(classeId), [classeId]);
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
      </View>

      <GrilleEdt
        c={c}
        cours={cours ?? []}
        jours={JOURS.slice()}
        montrerEntete
        insetBottom={insets.bottom}
        onTap={ouvrirEdition}
        onLong={confirmerSuppression}
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

/**
 * Grille temporelle façon carnet : une colonne par jour, chaque colonne coupée
 * en deux (A à gauche, B à droite). Les cours sont positionnés et dimensionnés
 * selon leur horaire réel (2 h = deux fois plus haut). Sert aux deux vues :
 * un seul jour (vue Jour) ou les six (vue Semaine).
 */
function GrilleEdt({
  c,
  cours,
  jours,
  montrerEntete,
  insetBottom,
  onTap,
  onLong,
}: {
  c: ThemeColors;
  cours: CoursEdt[];
  jours: Jour[];
  montrerEntete: boolean;
  insetBottom: number;
  onTap: (co: CoursEdt) => void;
  onLong: (co: CoursEdt) => void;
}) {
  const numsAffiches = useMemo(() => new Set<number>(jours.map((j) => j.num)), [jours]);
  const coursVisibles = useMemo(
    () => cours.filter((co) => numsAffiches.has(co.jour)),
    [cours, numsAffiches],
  );

  const { debutMin, finMin, heures } = useMemo(() => {
    if (coursVisibles.length === 0) return { debutMin: 0, finMin: 0, heures: [] as number[] };
    let min = Infinity;
    let max = -Infinity;
    for (const co of coursVisibles) {
      min = Math.min(min, heureEnMinutes(co.heureDebut));
      max = Math.max(max, heureEnMinutes(co.heureFin));
    }
    // la journée s'affiche de 8h à 18h, élargie si un cours déborde
    const debutMin = Math.min(Math.floor(min / 60) * 60, DEBUT_JOURNEE);
    const finMin = Math.max(Math.ceil(max / 60) * 60, FIN_JOURNEE);
    const heures: number[] = [];
    for (let h = debutMin / 60; h <= finMin / 60; h++) heures.push(h);
    return { debutMin, finMin, heures };
  }, [coursVisibles]);

  const hauteur = (finMin - debutMin) * PX_PAR_MIN;

  if (coursVisibles.length === 0) {
    return (
      <View style={styles.corps}>
        <ThemedText style={[styles.vide, { color: c.textSecondary }]}>
          Aucun cours{jours.length === 1 ? ` le ${jours[0].long.toLowerCase()}` : ''}.{'\n'}
          Ajoute l’emploi du temps complet de la classe (toutes matières) pour que
          les créneaux de colle se calculent tout seuls.
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.corps} contentContainerStyle={{ paddingBottom: Spacing.six + insetBottom }}>
      {montrerEntete && (
        <View style={styles.grilleEntete}>
          <View style={{ width: GUTTER }} />
          {jours.map((j) => (
            <View key={j.num} style={[styles.grilleColEntete, { borderColor: c.border }]}>
              <ThemedText type="small" style={{ fontWeight: '700' }}>
                {j.court}
              </ThemedText>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.grilleCorps, { height: hauteur }]}>
        {/* colonne des heures */}
        <View style={{ width: GUTTER }}>
          {heures.map((h) => (
            <ThemedText
              key={h}
              type="small"
              style={[styles.heureAxe, { top: (h * 60 - debutMin) * PX_PAR_MIN - 7, color: c.textSecondary }]}>
              {h}h
            </ThemedText>
          ))}
        </View>

        {/* une colonne par jour, coupée A | B */}
        {jours.map((j) => {
          const duJour = coursVisibles.filter((co) => co.jour === j.num);
          return (
            <View key={j.num} style={[styles.grilleCol, { borderColor: c.border }]}>
              {/* filets horaires */}
              {heures.map((h) => (
                <View
                  key={h}
                  style={[styles.filetHeure, { top: (h * 60 - debutMin) * PX_PAR_MIN, backgroundColor: c.border }]}
                />
              ))}
              {/* séparateur vertical A | B */}
              <View style={[styles.filetAB, { backgroundColor: c.border }]} />

              {/* blocs de cours */}
              {duJour.map((co) => {
                const info = infosCours(co);
                const top = (heureEnMinutes(co.heureDebut) - debutMin) * PX_PAR_MIN;
                const h = (heureEnMinutes(co.heureFin) - heureEnMinutes(co.heureDebut)) * PX_PAR_MIN;
                const fond = info.couleur ?? c.backgroundSelected;
                const texte = info.couleur ? texteSurCouleur(info.couleur) : c.text;
                const specifique = co.semaine !== 'toutes';
                return (
                  <Pressable
                    key={co.id}
                    onPress={() => onTap(co)}
                    onLongPress={() => onLong(co)}
                    style={[
                      styles.bloc,
                      positionHoriz(co.semaine),
                      { top, height: h, backgroundColor: fond, borderColor: c.background },
                    ]}>
                    {co.estMonCours && <View style={[styles.blocMoi, { backgroundColor: c.accent }]} />}
                    <ThemedText
                      numberOfLines={2}
                      style={{ color: texte, fontSize: 10, fontWeight: '700', paddingRight: specifique ? 12 : 0 }}>
                      {info.nom}
                    </ThemedText>
                    {h >= 40 && co.salle && (
                      <ThemedText style={{ color: texte, fontSize: 9, opacity: 0.9 }}>{co.salle}</ThemedText>
                    )}
                    {specifique && (
                      <View style={styles.blocAB}>
                        <ThemedText style={styles.blocABTexte}>{co.semaine}</ThemedText>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>
    </ScrollView>
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
  corps: { flex: 1 },
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

  vide: { textAlign: 'center', margin: Spacing.four, lineHeight: 20 },

  // Grille (jour et semaine)
  grilleEntete: { flexDirection: 'row' },
  grilleColEntete: { flex: 1, alignItems: 'center', paddingVertical: Spacing.one, borderLeftWidth: StyleSheet.hairlineWidth },
  grilleCorps: { flexDirection: 'row' },
  grilleCol: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, position: 'relative' },
  heureAxe: { position: 'absolute', right: 4, textAlign: 'right' },
  filetHeure: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  filetAB: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: StyleSheet.hairlineWidth },
  bloc: {
    position: 'absolute',
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 3,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  blocMoi: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  blocAB: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 3,
    paddingBottom: 1,
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  blocABTexte: { color: '#fff', fontSize: 9, fontWeight: '800' },

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

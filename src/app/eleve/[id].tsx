import { and, between, desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarEleve } from '@/components/avatar-eleve';
import { BadgesAmenagements } from '@/components/badges-amenagements';
import { BlocCollesEleve } from '@/components/bloc-colles-eleve';
import { BlocNotesEleve } from '@/components/bloc-notes-eleve';
import { EditeurDossier } from '@/components/editeur-dossier';
import { ModaleCentree } from '@/components/modale-centree';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { aujourdhui, infosObservation, OBSERVATIONS } from '@/constants/observations';
import { infosSuivi, SUIVIS } from '@/constants/suivis';
import { CardShadow, Colors, Radius, Spacing } from '@/constants/theme';
import { useAnneeActive } from '@/hooks/use-annee-active';
import { bornesTrimestre, formatDateCourte, trimestreDeDate } from '@/lib/trimestre';
import { db } from '@/db';
import { creerColle, selectObservationsCollables, supprimerColle } from '@/db/colles';
import {
  annoterObservation,
  basculerObservation,
  supprimerObservation,
} from '@/db/observations';
import { creerSuivi, reglerSuivi, selectSuivisEleve, supprimerSuivi } from '@/db/suivis';
import { genererMotif } from '@/lib/colle-texte';
import { classes, eleves, inscriptions, observations, type TypeObservation, type TypeSuivi } from '@/db/schema';
import {
  bornesMois,
  formatJourCourt,
  formatMois,
  grilleMois,
  JOURS_COURTS,
  moisCourant,
  moisPrecedent,
  moisSuivant,
} from '@/lib/calendrier';

type ObsAffichee = {
  id: number;
  type: TypeObservation;
  date: string;
  commentaire: string | null;
};

export default function FicheEleve() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eleveId = Number(id);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  const [mois, setMois] = useState(moisCourant());
  // aujourd'hui est sélectionné d'emblée : c'est le jour sur lequel on écrit
  // dans la quasi-totalité des cas
  const [jourSelectionne, setJourSelectionne] = useState<string | null>(aujourdhui());
  // filtre par type, activé en tapant un compteur : met la liste et le
  // calendrier en focus sur ce seul type sur tout le trimestre
  const [typeFiltre, setTypeFiltre] = useState<TypeObservation | null>(null);
  const [aAnnoter, setAAnnoter] = useState<ObsAffichee | null>(null);
  const [texteNote, setTexteNote] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [dossierOuvert, setDossierOuvert] = useState(false);
  // ajout d'un « à vérifier » depuis la fiche
  const [ajoutSuivi, setAjoutSuivi] = useState(false);
  const [typeSuivi, setTypeSuivi] = useState<TypeSuivi>('rattrapage_cours');
  const [libelleSuivi, setLibelleSuivi] = useState('');

  const { annee, bornes } = useAnneeActive();
  const { debut, fin } = bornesMois(mois);
  const jourJ = aujourdhui();
  /**
   * Les boutons de saisie n'écrivent QUE sur le jour sélectionné. Sans jour
   * sélectionné ils sont désactivés, plutôt que de retomber silencieusement
   * sur aujourd'hui : c'est ce repli implicite qui faisait diverger l'état des
   * boutons et celui de la liste.
   */
  const jourActif = jourSelectionne;

  const { data: fiches } = useLiveQuery(
    db
      .select({
        nom: eleves.nom,
        prenom: eleves.prenom,
        amenagements: eleves.amenagements,
        photoUri: eleves.photoUri,
        infos: eleves.infos,
        mailsParents: eleves.mailsParents,
        inscriptionId: inscriptions.id,
        classeNom: classes.nom,
        couleur: classes.couleur,
      })
      .from(eleves)
      .innerJoin(inscriptions, eq(inscriptions.eleveId, eleves.id))
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(eleves.id, eleveId)),
    [eleveId],
  );
  const fiche = fiches?.[0];

  const { data: suivisOuverts } = useLiveQuery(
    selectSuivisEleve(fiche?.inscriptionId ?? -1),
    [fiche?.inscriptionId],
  );

  const { data: duMois } = useLiveQuery(
    db
      .select({
        id: observations.id,
        type: observations.type,
        date: observations.date,
        commentaire: observations.commentaire,
      })
      .from(observations)
      .innerJoin(inscriptions, eq(inscriptions.id, observations.inscriptionId))
      .where(and(eq(inscriptions.eleveId, eleveId), between(observations.date, debut, fin)))
      .orderBy(desc(observations.date)),
    [eleveId, debut, fin],
  );

  // requête séparée pour le jour actif : il peut être hors du mois affiché
  // (aujourd'hui alors qu'on consulte mars), donc on ne peut pas le déduire
  // du mois courant.
  const { data: duJour } = useLiveQuery(
    db
      .select({
        id: observations.id,
        type: observations.type,
        date: observations.date,
        commentaire: observations.commentaire,
      })
      .from(observations)
      .innerJoin(inscriptions, eq(inscriptions.id, observations.inscriptionId))
      // chaîne vide quand aucun jour n'est choisi : ne correspond à rien
      .where(and(eq(inscriptions.eleveId, eleveId), eq(observations.date, jourActif ?? ''))),
    [eleveId, jourActif],
  );

  const typesDuJour = useMemo(
    () => new Set((duJour ?? []).map((o) => o.type)),
    [duJour],
  );

  const parJour = useMemo(() => {
    const map = new Map<string, TypeObservation[]>();
    for (const o of duMois ?? []) {
      const liste = map.get(o.date) ?? [];
      if (!liste.includes(o.type)) liste.push(o.type);
      map.set(o.date, liste);
    }
    return map;
  }, [duMois]);

  // Le bilan chiffré porte sur le TRIMESTRE, pas sur le mois affiché : c'est la
  // vision globale demandée (« Kevin, 6 exos non faits ce trimestre »). Le
  // trimestre est celui du mois qu'on regarde, pour rester cohérent avec la
  // navigation.
  const trimestreAffiche =
    bornes && `${mois.annee}-${String(mois.mois).padStart(2, '0')}-15`
      ? trimestreDeDate(`${mois.annee}-${String(mois.mois).padStart(2, '0')}-15`, bornes)
      : null;

  const rangeTrimestre =
    bornes && annee && trimestreAffiche
      ? bornesTrimestre(trimestreAffiche, annee.libelle, bornes)
      : null;

  // sert à la fois aux compteurs ET à la liste chronologique « tout le
  // trimestre », d'où les champs complets et le tri.
  const { data: duTrimestre } = useLiveQuery(
    db
      .select({
        id: observations.id,
        type: observations.type,
        date: observations.date,
        commentaire: observations.commentaire,
      })
      .from(observations)
      .innerJoin(inscriptions, eq(inscriptions.id, observations.inscriptionId))
      .where(
        and(
          eq(inscriptions.eleveId, eleveId),
          between(observations.date, rangeTrimestre?.debut ?? '', rangeTrimestre?.fin ?? ''),
        ),
      )
      .orderBy(desc(observations.date)),
    [eleveId, rangeTrimestre?.debut, rangeTrimestre?.fin],
  );

  const compteurs = useMemo(() => {
    const map = new Map<TypeObservation, number>();
    for (const o of duTrimestre ?? []) map.set(o.type, (map.get(o.type) ?? 0) + 1);
    return map;
  }, [duTrimestre]);

  // filtre et jour sélectionné sont exclusifs : chacun répond à une question
  // différente (quel type ? / quel jour ?), les cumuler embrouillerait la liste
  function basculerFiltre(t: TypeObservation) {
    setJourSelectionne(null);
    setTypeFiltre((prec) => (prec === t ? null : t));
  }

  function selectionnerJour(date: string | null) {
    setTypeFiltre(null);
    setJourSelectionne(date);
  }

  function changerMois(suivant: boolean) {
    setMois(suivant ? moisSuivant(mois) : moisPrecedent(mois));
    setJourSelectionne(null);
  }

  function ouvrirAnnotation(o: ObsAffichee) {
    setAAnnoter(o);
    setTexteNote(o.commentaire ?? '');
  }

  async function enregistrerAnnotation() {
    if (!aAnnoter) return;
    await annoterObservation(aAnnoter.id, texteNote);
    setAAnnoter(null);
    setTexteNote('');
  }

  /**
   * Colle instantanée : motif pré-rempli avec les exos non faits / oublis du
   * trimestre, sans date (elle se met plus tard depuis l'écran Colles). Le but
   * est de capturer en un geste en classe, pas de tout saisir sur le moment.
   */
  async function collerRapide() {
    if (!fiche || !annee || !bornes) return;
    const t = trimestreDeDate(jourJ, bornes);
    const { debut, fin } = bornesTrimestre(t, annee.libelle, bornes);
    const obs = await selectObservationsCollables(fiche.inscriptionId, debut, fin);
    const motif = genererMotif(obs.map((o) => ({ type: o.type, date: o.date })));
    const id = await creerColle(fiche.inscriptionId, null, motif);
    Alert.alert(
      'Colle créée',
      (motif ? `Motif : ${motif}\n\n` : 'Sans motif pour l’instant.\n\n') +
        'À compléter (date, etc.) dans l’écran Colles.',
      [
        { text: 'Annuler', style: 'destructive', onPress: () => supprimerColle(id) },
        { text: 'OK' },
      ],
    );
  }

  function confirmerSuppression(o: ObsAffichee) {
    Alert.alert(
      'Supprimer cette observation ?',
      `${infosObservation(o.type).label} — ${formatJourCourt(o.date)}`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => supprimerObservation(o.id) },
      ],
    );
  }

  const semaines = grilleMois(mois);
  // liste détaillée : le jour choisi ; sinon le trimestre, éventuellement
  // restreint au type filtré
  const listeAffichee: ObsAffichee[] = jourSelectionne
    ? (duJour ?? [])
    : (duTrimestre ?? []).filter((o) => !typeFiltre || o.type === typeFiltre);
  const libelleJourActif = !jourActif
    ? 'Choisis un jour dans le calendrier pour noter'
    : jourActif === jourJ
      ? 'Noter aujourd’hui — retape pour annuler'
      : `Noter le ${formatJourCourt(jourActif)} — retape pour annuler`;

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen
        options={{
          title: fiche ? `${fiche.prenom} ${fiche.nom.toLocaleUpperCase('fr-FR')}` : 'Élève',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingBottom: Spacing.six + insets.bottom }]}>
        {fiche && (
          <PressableScale
            onPress={() => setDossierOuvert(true)}
            style={[
              styles.bloc,
              { backgroundColor: c.backgroundElement, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth },
              CardShadow,
            ]}>
            <View style={styles.enTete}>
              <AvatarEleve
                photoUri={fiche.photoUri}
                initiales={(fiche.prenom[0] ?? '') + (fiche.nom[0] ?? '')}
                taille={52}
                couleur={fiche.couleur}
              />
              <View style={{ flex: 1, gap: Spacing.half }}>
                <ThemedText style={styles.nom}>
                  {fiche.nom.toLocaleUpperCase('fr-FR')} {fiche.prenom}
                </ThemedText>
                <ThemedText type="small" style={{ color: c.textSecondary }}>
                  {fiche.classeNom}
                </ThemedText>
              </View>
            </View>

            <BadgesAmenagements amenagements={fiche.amenagements} max={99} toujoursVisible />

            {fiche.infos ? (
              <ThemedText type="small">{fiche.infos}</ThemedText>
            ) : (
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {fiche.amenagements.length === 0
                  ? 'Aucun aménagement noté — tape pour remplir le dossier'
                  : 'Tape pour modifier le dossier'}
              </ThemedText>
            )}
          </PressableScale>
        )}

        {/* Saisie : agit sur le jour sélectionné, ou sur aujourd'hui par défaut */}
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {libelleJourActif}
        </ThemedText>
        <View style={[styles.saisie, !jourActif && styles.saisieInactive]}>
          {OBSERVATIONS.map((o) => {
            const actif = typesDuJour.has(o.type);
            return (
              <PressableScale
                key={o.type}
                disabled={!jourActif || enCours}
                onPress={async () => {
                  if (!fiche || !jourActif) return;
                  // verrou le temps de l'écriture : deux taps rapprochés
                  // pouvaient créer un doublon avant que l'état se rafraîchisse
                  setEnCours(true);
                  try {
                    await basculerObservation(fiche.inscriptionId, o.type, jourActif);
                  } finally {
                    setEnCours(false);
                  }
                }}
                style={[
                  styles.boutonSaisie,
                  actif
                    ? { backgroundColor: o.couleur }
                    : { backgroundColor: c.backgroundElement, opacity: 0.75, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth },
                ]}>
                <ThemedText style={styles.emoji}>{o.emoji}</ThemedText>
                <ThemedText
                  style={[styles.labelSaisie, { color: actif ? '#fff' : c.textSecondary }]}
                  numberOfLines={2}>
                  {o.label}
                </ThemedText>
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.navMois}>
          <Pressable onPress={() => changerMois(false)} style={styles.fleche}>
            <ThemedText style={styles.flecheTexte}>‹</ThemedText>
          </Pressable>
          <ThemedText style={styles.titreMois}>{formatMois(mois)}</ThemedText>
          <Pressable onPress={() => changerMois(true)} style={styles.fleche}>
            <ThemedText style={styles.flecheTexte}>›</ThemedText>
          </Pressable>
        </View>

        <View style={[styles.bloc, { backgroundColor: c.backgroundElement }]}>
          <View style={styles.semaine}>
            {JOURS_COURTS.map((j, i) => (
              <ThemedText
                key={i}
                type="small"
                style={[styles.enTeteJour, { color: c.textSecondary }]}>
                {j}
              </ThemedText>
            ))}
          </View>

          {semaines.map((semaine, i) => (
            <View key={i} style={styles.semaine}>
              {semaine.map((date, j) => {
                if (!date) return <View key={j} style={styles.jour} />;
                const types = parJour.get(date);
                const estAujourdhui = date === jourJ;
                const estSelectionne = date === jourSelectionne;
                // filtre actif : le jour est mis en avant s'il porte ce type,
                // et les pastilles laissent place à un surlignage franc
                const surligne = !!typeFiltre && !!types?.includes(typeFiltre);
                const attenue = !!typeFiltre && !surligne;
                return (
                  <Pressable
                    key={j}
                    onPress={() => selectionnerJour(estSelectionne ? null : date)}
                    style={styles.jour}>
                    <View
                      style={[
                        styles.numeroCercle,
                        estAujourdhui && { backgroundColor: c.backgroundSelected },
                        surligne && { backgroundColor: infosObservation(typeFiltre).couleur },
                        estSelectionne && { backgroundColor: c.text },
                      ]}>
                      <ThemedText
                        type="small"
                        style={{
                          color: estSelectionne
                            ? c.background
                            : surligne
                              ? '#fff'
                              : attenue
                                ? c.textSecondary
                                : types
                                  ? c.text
                                  : c.textSecondary,
                          opacity: attenue ? 0.4 : 1,
                        }}>
                        {Number(date.split('-')[2])}
                      </ThemedText>
                    </View>
                    {/* pastilles masquées pendant le filtrage : le surlignage
                        du jour porte déjà l'information */}
                    <View style={styles.pastilles}>
                      {!typeFiltre &&
                        types?.slice(0, 3).map((t) => (
                          <View
                            key={t}
                            style={[
                              styles.pastille,
                              { backgroundColor: infosObservation(t).couleur },
                            ]}
                          />
                        ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Bilan du TRIMESTRE, indépendant du mois affiché et du jour
            sélectionné : c'est la vision globale sur la période. */}
        {(duTrimestre?.length ?? 0) > 0 && trimestreAffiche && rangeTrimestre && (
          <>
            <ThemedText type="small" style={{ color: c.textSecondary }}>
              Total T{trimestreAffiche} · {formatDateCourte(rangeTrimestre.debut)} –{' '}
              {formatDateCourte(rangeTrimestre.fin)}
            </ThemedText>
            <View style={styles.compteurs}>
              {OBSERVATIONS.filter((o) => (compteurs.get(o.type) ?? 0) > 0).map((o) => {
                const actif = typeFiltre === o.type;
                return (
                  <Pressable
                    key={o.type}
                    onPress={() => basculerFiltre(o.type)}
                    style={[
                      styles.compteur,
                      { borderColor: o.couleur, backgroundColor: actif ? o.couleur : 'transparent' },
                    ]}>
                    <ThemedText
                      style={[styles.compteurNombre, { color: actif ? '#fff' : o.couleur }]}>
                      {compteurs.get(o.type)}
                    </ThemedText>
                    <ThemedText type="small" style={actif ? { color: '#fff' } : undefined}>
                      {o.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* En-tête de la liste : jour choisi, type filtré, ou trimestre entier */}
        <View style={styles.enTeteListe}>
          <ThemedText style={styles.titreListe}>
            {jourSelectionne
              ? formatJourCourt(jourSelectionne)
              : typeFiltre
                ? infosObservation(typeFiltre).label
                : trimestreAffiche
                  ? `Trimestre ${trimestreAffiche}`
                  : formatMois(mois)}
          </ThemedText>
          {(jourSelectionne || typeFiltre) && (
            <Pressable
              onPress={() => {
                setJourSelectionne(null);
                setTypeFiltre(null);
              }}>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                Voir tout le trimestre
              </ThemedText>
            </Pressable>
          )}
        </View>

        {listeAffichee.length === 0 ? (
          <ThemedText style={[styles.vide, { color: c.textSecondary }]}>
            {jourSelectionne
              ? 'Rien de noté ce jour-là.'
              : typeFiltre
                ? `Aucun « ${infosObservation(typeFiltre).label} » ce trimestre.`
                : trimestreAffiche
                  ? `Rien de noté au trimestre ${trimestreAffiche}.`
                  : `Rien de noté en ${formatMois(mois)}.`}
          </ThemedText>
        ) : (
          listeAffichee.map((o) => {
            const info = infosObservation(o.type);
            return (
              <Pressable
                key={o.id}
                onPress={() => ouvrirAnnotation(o)}
                onLongPress={() => confirmerSuppression(o)}
                style={[styles.ligne, { backgroundColor: c.backgroundElement }]}>
                <View style={[styles.barre, { backgroundColor: info.couleur }]} />
                <View style={{ flex: 1, gap: Spacing.half }}>
                  <ThemedText style={styles.ligneTitre}>
                    {info.emoji} {info.label}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: o.commentaire ? c.text : c.textSecondary }}>
                    {o.commentaire ?? 'Ajouter une précision…'}
                  </ThemedText>
                </View>
                <ThemedText type="small" style={{ color: c.textSecondary }}>
                  {formatJourCourt(o.date)}
                </ThemedText>
              </Pressable>
            );
          })
        )}

        {/* À vérifier : boucles ouvertes (rattrapages, cahier, exo…) */}
        {fiche && (
          <View style={styles.suivisSection}>
            <View style={styles.suivisEntete}>
              <ThemedText style={styles.titreListe}>À vérifier</ThemedText>
              <Pressable
                onPress={() => setAjoutSuivi(true)}
                hitSlop={8}
                style={[styles.boutonPlus, { borderColor: c.border }]}>
                <ThemedText style={{ color: c.accent, fontWeight: '800', fontSize: 16 }}>+</ThemedText>
              </Pressable>
            </View>
            {(suivisOuverts?.length ?? 0) === 0 ? (
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                Rien à vérifier.
              </ThemedText>
            ) : (
              suivisOuverts?.map((s) => {
                const info = infosSuivi(s.type);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => reglerSuivi(s.id)}
                    onLongPress={() =>
                      Alert.alert('Supprimer ce suivi ?', info.label, [
                        { text: 'Annuler', style: 'cancel' },
                        { text: 'Supprimer', style: 'destructive', onPress: () => supprimerSuivi(s.id) },
                      ])
                    }
                    style={[styles.suiviLigne, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
                    <View style={[styles.pastilleSuivi, { backgroundColor: info.couleur }]}>
                      <ThemedText style={{ fontSize: 13 }}>{info.emoji}</ThemedText>
                    </View>
                    <ThemedText style={{ flex: 1, fontWeight: '600' }} numberOfLines={2}>
                      {s.dernierAvertissement ? '⚠ ' : ''}
                      {s.libelle ? `${info.label} — ${s.libelle}` : info.label}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: c.textSecondary }}>
                      ✓ réglé
                    </ThemedText>
                  </Pressable>
                );
              })
            )}

            <PressableScale
              onPress={collerRapide}
              style={[styles.boutonColler, { borderColor: c.border, backgroundColor: c.backgroundElement }]}>
              <ThemedText style={{ fontWeight: '700' }}>🔒 Coller {fiche.prenom}</ThemedText>
            </PressableScale>
          </View>
        )}

        {fiche && <BlocCollesEleve inscriptionId={fiche.inscriptionId} />}
        <BlocNotesEleve eleveId={eleveId} />
      </ScrollView>

      {fiche && (
        <EditeurDossier
          visible={dossierOuvert}
          eleveId={eleveId}
          nomComplet={`${fiche.prenom} ${fiche.nom.toLocaleUpperCase('fr-FR')}`}
          photoUri={fiche.photoUri}
          amenagements={fiche.amenagements}
          infos={fiche.infos}
          mailsParents={fiche.mailsParents}
          onFermer={() => setDossierOuvert(false)}
        />
      )}

      {/* Annotation d'une observation : "54 p.23", "a oublié sa règle"… */}
      <ModaleCentree visible={aAnnoter !== null} onClose={() => setAAnnoter(null)}>
        {aAnnoter && (
          <>
            <ThemedText type="subtitle">
              {infosObservation(aAnnoter.type).emoji} {infosObservation(aAnnoter.type).label}
            </ThemedText>
            <ThemedText type="small" style={{ color: c.textSecondary }}>
              {formatJourCourt(aAnnoter.date)}
            </ThemedText>

            <TextInput
              value={texteNote}
              onChangeText={setTexteNote}
              placeholder="54 p.23"
              placeholderTextColor={c.textSecondary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={enregistrerAnnotation}
              style={[styles.champ, { color: c.text, borderColor: c.border }]}
            />

            <PressableScale
              onPress={enregistrerAnnotation}
              style={[styles.bouton, { backgroundColor: c.accent }]}>
              <ThemedText style={[styles.ligneTitre, { color: c.accentText }]}>
                Enregistrer
              </ThemedText>
            </PressableScale>
          </>
        )}
      </ModaleCentree>

      {/* Ajout d'un « à vérifier » depuis la fiche */}
      <ModaleCentree visible={ajoutSuivi} onClose={() => setAjoutSuivi(false)}>
        <ThemedText type="subtitle">À vérifier</ThemedText>
        <View style={styles.typesSuivi}>
          {SUIVIS.map((s) => {
            const actif = typeSuivi === s.type;
            return (
              <Pressable
                key={s.type}
                onPress={() => setTypeSuivi(s.type)}
                style={[
                  styles.typeSuiviPill,
                  { borderColor: actif ? s.couleur : c.border, backgroundColor: actif ? s.couleur : 'transparent' },
                ]}>
                <ThemedText type="small" style={{ color: actif ? '#fff' : c.text, fontWeight: '700' }}>
                  {s.emoji} {s.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={libelleSuivi}
          onChangeText={setLibelleSuivi}
          placeholder="Précision (optionnel)"
          placeholderTextColor={c.textSecondary}
          style={[styles.champ, { color: c.text, borderColor: c.border }]}
        />
        <PressableScale
          onPress={async () => {
            if (!fiche) return;
            await creerSuivi({ inscriptionId: fiche.inscriptionId, type: typeSuivi, libelle: libelleSuivi });
            setAjoutSuivi(false);
            setLibelleSuivi('');
            setTypeSuivi('rattrapage_cours');
          }}
          style={[styles.bouton, { backgroundColor: c.accent }]}>
          <ThemedText style={[styles.ligneTitre, { color: c.accentText }]}>Ajouter</ThemedText>
        </PressableScale>
      </ModaleCentree>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { padding: Spacing.three, gap: Spacing.three },
  suivisSection: { gap: Spacing.two },
  suivisEntete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boutonPlus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suiviLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.s,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pastilleSuivi: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  typesSuivi: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  typeSuiviPill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, borderWidth: 1 },
  bloc: {
    borderRadius: Radius.m,
    padding: Spacing.three,
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    ...CardShadow,
  },
  enTete: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  initiales: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialesTexte: { color: '#fff', fontWeight: '700', fontSize: 18 },
  nom: { fontSize: 17, fontWeight: '600' },

  boutonColler: {
    padding: Spacing.three,
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  saisie: { flexDirection: 'row', gap: Spacing.two },
  saisieInactive: { opacity: 0.4 },
  boutonSaisie: {
    flex: 1,
    borderRadius: Radius.s,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: Spacing.half,
    minHeight: 64,
    justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  labelSaisie: { fontSize: 10, fontWeight: '700', textAlign: 'center' },

  navMois: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fleche: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  flecheTexte: { fontSize: 28, lineHeight: 32 },
  titreMois: { fontSize: 17, fontWeight: '600', textTransform: 'capitalize' },

  semaine: { flexDirection: 'row' },
  enTeteJour: { flex: 1, textAlign: 'center' },
  jour: { flex: 1, alignItems: 'center', paddingVertical: Spacing.half, gap: 2 },
  numeroCercle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastilles: { flexDirection: 'row', gap: 2, height: 6 },
  pastille: { width: 5, height: 5, borderRadius: 3 },

  compteurs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  compteur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 2,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  compteurNombre: { fontSize: 20, fontWeight: '700' },

  enTeteListe: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  titreListe: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  vide: { textAlign: 'center', marginTop: Spacing.three },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  barre: { width: 4, height: 36, borderRadius: 2 },
  ligneTitre: { fontSize: 15, fontWeight: '600' },

  champ: {
    borderWidth: 1,
    borderRadius: Radius.s,
    padding: Spacing.three,
    fontSize: 18,
  },
  bouton: { padding: Spacing.three, borderRadius: Radius.s, alignItems: 'center' },
});

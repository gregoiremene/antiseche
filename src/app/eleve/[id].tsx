import { and, between, desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';
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

import { BadgesAmenagements } from '@/components/badges-amenagements';
import { BlocNotesEleve } from '@/components/bloc-notes-eleve';
import { EditeurDossier } from '@/components/editeur-dossier';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { aujourdhui, infosObservation, OBSERVATIONS } from '@/constants/observations';
import { Colors, Spacing } from '@/constants/theme';
import { db } from '@/db';
import {
  annoterObservation,
  basculerObservation,
  supprimerObservation,
} from '@/db/observations';
import { classes, eleves, inscriptions, observations, type TypeObservation } from '@/db/schema';
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
  const [aAnnoter, setAAnnoter] = useState<ObsAffichee | null>(null);
  const [texteNote, setTexteNote] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [dossierOuvert, setDossierOuvert] = useState(false);

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
        infos: eleves.infos,
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

  const compteurs = useMemo(() => {
    const map = new Map<TypeObservation, number>();
    for (const o of duMois ?? []) map.set(o.type, (map.get(o.type) ?? 0) + 1);
    return map;
  }, [duMois]);

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
  const listeAffichee: ObsAffichee[] = jourSelectionne ? (duJour ?? []) : (duMois ?? []);
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
          <Pressable
            onPress={() => setDossierOuvert(true)}
            style={[styles.bloc, { backgroundColor: c.backgroundElement }]}>
            <View style={styles.enTete}>
              <View style={[styles.initiales, { backgroundColor: fiche.couleur }]}>
                <ThemedText style={styles.initialesTexte}>
                  {(fiche.prenom[0] ?? '') + (fiche.nom[0] ?? '')}
                </ThemedText>
              </View>
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
          </Pressable>
        )}

        {/* Saisie : agit sur le jour sélectionné, ou sur aujourd'hui par défaut */}
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {libelleJourActif}
        </ThemedText>
        <View style={[styles.saisie, !jourActif && styles.saisieInactive]}>
          {OBSERVATIONS.map((o) => {
            const actif = typesDuJour.has(o.type);
            return (
              <Pressable
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
                    : { backgroundColor: c.backgroundElement, opacity: 0.75 },
                ]}>
                <ThemedText style={styles.emoji}>{o.emoji}</ThemedText>
                <ThemedText
                  style={[styles.labelSaisie, { color: actif ? '#fff' : c.textSecondary }]}
                  numberOfLines={2}>
                  {o.label}
                </ThemedText>
              </Pressable>
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
                return (
                  <Pressable
                    key={j}
                    onPress={() => setJourSelectionne(estSelectionne ? null : date)}
                    style={styles.jour}>
                    <View
                      style={[
                        styles.numeroCercle,
                        estAujourdhui && { backgroundColor: c.backgroundSelected },
                        estSelectionne && { backgroundColor: c.text },
                      ]}>
                      <ThemedText
                        type="small"
                        style={{
                          color: estSelectionne
                            ? c.background
                            : types
                              ? c.text
                              : c.textSecondary,
                        }}>
                        {Number(date.split('-')[2])}
                      </ThemedText>
                    </View>
                    <View style={styles.pastilles}>
                      {types?.slice(0, 3).map((t) => (
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

        {/* Bilan du mois affiché : indépendant du jour sélectionné, sinon deux
            zones de l'écran décrivent des périodes différentes sans le dire. */}
        {(duMois?.length ?? 0) > 0 && (
          <>
            <ThemedText type="small" style={{ color: c.textSecondary }}>
              Total sur {formatMois(mois)}
            </ThemedText>
            <View style={styles.compteurs}>
              {OBSERVATIONS.filter((o) => (compteurs.get(o.type) ?? 0) > 0).map((o) => (
                <View key={o.type} style={[styles.compteur, { borderColor: o.couleur }]}>
                  <ThemedText style={[styles.compteurNombre, { color: o.couleur }]}>
                    {compteurs.get(o.type)}
                  </ThemedText>
                  <ThemedText type="small">{o.label}</ThemedText>
                </View>
              ))}
            </View>
          </>
        )}

        {/* En-tête de la liste : mois entier, ou jour sélectionné */}
        <View style={styles.enTeteListe}>
          <ThemedText style={styles.titreListe}>
            {jourSelectionne ? formatJourCourt(jourSelectionne) : formatMois(mois)}
          </ThemedText>
          {jourSelectionne && (
            <Pressable onPress={() => setJourSelectionne(null)}>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                Voir tout le mois
              </ThemedText>
            </Pressable>
          )}
        </View>

        {listeAffichee.length === 0 ? (
          <ThemedText style={[styles.vide, { color: c.textSecondary }]}>
            {jourSelectionne ? 'Rien de noté ce jour-là.' : `Rien de noté en ${formatMois(mois)}.`}
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

        <BlocNotesEleve eleveId={eleveId} />
      </ScrollView>

      {fiche && (
        <EditeurDossier
          visible={dossierOuvert}
          eleveId={eleveId}
          nomComplet={`${fiche.prenom} ${fiche.nom.toLocaleUpperCase('fr-FR')}`}
          amenagements={fiche.amenagements}
          infos={fiche.infos}
          onFermer={() => setDossierOuvert(false)}
        />
      )}

      {/* Annotation d'une observation : "54 p.23", "a oublié sa règle"… */}
      <Modal visible={aAnnoter !== null} animationType="slide" transparent>
        <Pressable style={styles.fond} onPress={() => setAAnnoter(null)} />
        <ThemedView
          type="backgroundElement"
          style={[styles.feuille, { paddingBottom: Spacing.five + insets.bottom }]}>
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
                style={[styles.champ, { color: c.text, borderColor: c.backgroundSelected }]}
              />

              <Pressable
                onPress={enregistrerAnnotation}
                style={[styles.bouton, { backgroundColor: c.text }]}>
                <ThemedText style={[styles.ligneTitre, { color: c.background }]}>
                  Enregistrer
                </ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { padding: Spacing.three, gap: Spacing.three },
  bloc: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
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

  saisie: { flexDirection: 'row', gap: Spacing.two },
  saisieInactive: { opacity: 0.4 },
  boutonSaisie: {
    flex: 1,
    borderRadius: Spacing.two,
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

  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  feuille: {
    padding: Spacing.four,
    gap: Spacing.three,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  champ: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 18,
  },
  bouton: { padding: Spacing.three, borderRadius: Spacing.two, alignItems: 'center' },
});

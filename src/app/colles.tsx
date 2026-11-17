import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModaleCentree } from '@/components/modale-centree';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, Colors, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { majColle, selectCollesDetaillees, supprimerColle } from '@/db/colles';
import { coursPourCreneaux, getOuCreerParametresEdt } from '@/db/edt';
import type { Surveillance } from '@/db/schema';
import { aujourdhuiISO, dateDepuisJourMois, formatJourAvecSemaine, formatJourCourt } from '@/lib/calendrier';
import { construireMailto, genererMailColle } from '@/lib/colle-texte';
import { reprogrammerNotifications } from '@/lib/notifications';
import { trouverCreneaux, type Creneau } from '@/lib/creneaux-colle';
import { formatHeure } from '@/lib/semaine-ab';

type Colle = Awaited<ReturnType<typeof selectCollesDetaillees>>[number];

/** Libellé lisible de la surveillance d'une colle. */
function texteSurveillance(surveillance: Surveillance | null, classe: string | null): string | null {
  if (!surveillance) return null;
  return surveillance === 'vie_scolaire'
    ? '🏫 vie scolaire'
    : `👥 ma salle${classe ? ` (avec ${classe})` : ''}`;
}

export default function EcranColles() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const jourJ = aujourdhuiISO();

  const { data: toutes } = useLiveQuery(selectCollesDetaillees());

  // les colles ont changé (créées, datées, pointées…) → on recale les notifs
  useEffect(() => {
    if (toutes) reprogrammerNotifications();
  }, [toutes]);

  const [edition, setEdition] = useState<Colle | null>(null);
  const [editJm, setEditJm] = useState({ jour: '', mois: '' });
  const [editMotif, setEditMotif] = useState('');
  const [editHeureDebut, setEditHeureDebut] = useState<string | null>(null);
  const [editHeureFin, setEditHeureFin] = useState<string | null>(null);
  const [editSurveillance, setEditSurveillance] = useState<Surveillance | null>(null);
  const [editSurveillanceClasse, setEditSurveillanceClasse] = useState<string | null>(null);
  // liste des créneaux trouvés : non-null = on affiche la liste au lieu du formulaire
  const [creneaux, setCreneaux] = useState<Creneau[] | null>(null);
  const [chargementCreneaux, setChargementCreneaux] = useState(false);

  function ouvrirEdition(colle: Colle) {
    setEdition(colle);
    setEditJm(colle.date ? jourMois(colle.date) : { jour: '', mois: '' });
    setEditMotif(colle.motif);
    setEditHeureDebut(colle.heureDebut);
    setEditHeureFin(colle.heureFin);
    setEditSurveillance(colle.surveillance);
    setEditSurveillanceClasse(colle.surveillanceClasse);
    setCreneaux(null);
  }

  function effacerCreneau() {
    setEditHeureDebut(null);
    setEditHeureFin(null);
    setEditSurveillance(null);
    setEditSurveillanceClasse(null);
  }

  async function chercherCreneaux() {
    if (!edition) return;
    setChargementCreneaux(true);
    try {
      const [cours, params] = await Promise.all([
        coursPourCreneaux(edition.classeId),
        getOuCreerParametresEdt(),
      ]);
      setCreneaux(
        trouverCreneaux({
          classeXId: edition.classeId,
          cours,
          ancre: { ancreLundi: params.ancreLundi, ancreType: params.ancreType },
          aujourdISO: jourJ,
        }),
      );
    } finally {
      setChargementCreneaux(false);
    }
  }

  function appliquerCreneau(cr: Creneau) {
    setEditJm(jourMois(cr.date));
    setEditHeureDebut(cr.heureDebut);
    setEditHeureFin(cr.heureFin);
    setEditSurveillance(cr.surveillance);
    setEditSurveillanceClasse(cr.classe);
    setCreneaux(null);
  }

  const dateEditee =
    editJm.jour && editJm.mois
      ? dateDepuisJourMois(Number(editJm.jour), Number(editJm.mois))
      : null;
  const apercuDate = !editJm.jour && !editJm.mois
    ? 'sans date'
    : dateEditee
      ? `→ ${formatJourCourt(dateEditee)}`
      : 'date invalide';

  async function enregistrerEdition() {
    if (!edition) return;
    await majColle(edition.id, {
      date: dateEditee,
      motif: editMotif.trim(),
      heureDebut: editHeureDebut,
      heureFin: editHeureFin,
      surveillance: editSurveillance,
      surveillanceClasse: editSurveillanceClasse,
    });
    setEdition(null);
  }

  const { aProgrammer, aVerifier, enCours, terminees } = useMemo(() => {
    const aProgrammer: Colle[] = [];
    const aVerifier: Colle[] = [];
    const enCours: Colle[] = [];
    const terminees: Colle[] = [];
    for (const c of toutes ?? []) {
      if (c.statut !== 'a_faire') terminees.push(c);
      else if (!c.date) aProgrammer.push(c);
      else if (c.date < jourJ) aVerifier.push(c);
      else enCours.push(c);
    }
    // sans date : la plus récemment créée d'abord
    aProgrammer.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // à vérifier / en cours : les plus urgentes d'abord (date croissante)
    aVerifier.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    enCours.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    return { aProgrammer, aVerifier, enCours, terminees };
  }, [toutes, jourJ]);

  async function ouvrirMail(colle: Colle) {
    if (!colle.date) return; // le mail annonce une date : sans date, rien à envoyer
    const { objet, corps } = genererMailColle({
      prenom: colle.prenom,
      nom: colle.nom,
      classe: colle.classe,
      date: colle.date,
      motif: colle.motif,
      heureDebut: colle.heureDebut,
      heureFin: colle.heureFin,
    });
    const url = construireMailto(colle.mailsParents, objet, corps);
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
      Alert.alert('Impossible d’ouvrir le mail', 'Aucune application de messagerie configurée.');
      return;
    }
    await Linking.openURL(url);
    // envoyer = prévenir : on coche l'étape
    await majColle(colle.id, { parentsPrevenus: true });
  }

  function confirmerSuppression(colle: Colle) {
    const quand = colle.date ? formatJourCourt(colle.date) : 'sans date';
    Alert.alert('Supprimer cette colle ?', `${colle.prenom} — ${quand}`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => supprimerColle(colle.id) },
    ]);
  }

  const total = toutes?.length ?? 0;

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen options={{ title: 'Colles' }} />

      <ScrollView contentContainerStyle={[styles.liste, { paddingBottom: Spacing.six + insets.bottom }]}>
        {total === 0 && (
          <ThemedText style={[styles.vide, { color: c.textSecondary }]}>
            Aucune colle.{'\n'}Colle un élève depuis sa fiche.
          </ThemedText>
        )}

        <Section titre="À programmer" sousTitre="capturées en cours, à compléter" colles={aProgrammer}>
          {(colle) => (
            <CarteColle
              key={colle.id}
              colle={colle}
              c={c}
              onPress={() => ouvrirEdition(colle)}
              onLong={() => confirmerSuppression(colle)}>
              <ThemedText type="small" style={{ color: c.accent }}>
                Tape pour définir la date et compléter le motif →
              </ThemedText>
            </CarteColle>
          )}
        </Section>

        <Section titre="À vérifier" sousTitre="retenue passée, à pointer" colles={aVerifier}>
          {(colle) => (
            <CarteColle
              key={colle.id}
              colle={colle}
              c={c}
              onPress={() => ouvrirEdition(colle)}
              onLong={() => confirmerSuppression(colle)}>
              <View style={styles.actions}>
                <PressableScale
                  onPress={() => majColle(colle.id, { statut: 'faite' })}
                  style={[styles.actionBtn, { backgroundColor: '#30A46C' }]}>
                  <ThemedText style={styles.actionTexte}>Faite ✓</ThemedText>
                </PressableScale>
                <PressableScale
                  onPress={() => majColle(colle.id, { statut: 'non_faite' })}
                  style={[styles.actionBtn, { backgroundColor: '#E5484D' }]}>
                  <ThemedText style={styles.actionTexte}>Absent·e</ThemedText>
                </PressableScale>
              </View>
            </CarteColle>
          )}
        </Section>

        <Section titre="En cours" sousTitre="à organiser" colles={enCours}>
          {(colle) => (
            <CarteColle
              key={colle.id}
              colle={colle}
              c={c}
              onPress={() => ouvrirEdition(colle)}
              onLong={() => confirmerSuppression(colle)}>
              <View style={styles.etapes}>
                <Etape
                  label="Posée sur Pronote"
                  actif={colle.poseePronote}
                  couleur={c}
                  onPress={() => majColle(colle.id, { poseePronote: !colle.poseePronote })}
                />
                <Etape
                  label="Élève prévenu·e"
                  actif={colle.elevePrevenu}
                  couleur={c}
                  onPress={() => majColle(colle.id, { elevePrevenu: !colle.elevePrevenu })}
                />
                <Etape
                  label="Parents prévenus"
                  actif={colle.parentsPrevenus}
                  couleur={c}
                  onPress={() => majColle(colle.id, { parentsPrevenus: !colle.parentsPrevenus })}
                />
                <Pressable
                  onPress={() => ouvrirMail(colle)}
                  disabled={!colle.mailsParents}
                  style={[
                    styles.etape,
                    { borderColor: c.accent, backgroundColor: c.accent, opacity: colle.mailsParents ? 1 : 0.4 },
                  ]}>
                  <ThemedText type="small" style={{ color: c.accentText }}>
                    ✉ Mail parents
                  </ThemedText>
                </Pressable>
              </View>
              {!colle.mailsParents && (
                <ThemedText type="small" style={{ color: c.textSecondary }}>
                  Aucun mail parent renseigné (fiche élève → Dossier).
                </ThemedText>
              )}
            </CarteColle>
          )}
        </Section>

        {terminees.length > 0 && (
          <Section titre="Terminées" colles={terminees}>
            {(colle) => (
              <Pressable
                key={colle.id}
                onLongPress={() => confirmerSuppression(colle)}
                style={[styles.carteFinie, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
                <View style={[styles.pastille, { backgroundColor: colle.couleur }]} />
                <ThemedText style={{ flex: 1 }} numberOfLines={1}>
                  {colle.prenom}
                  {colle.date ? ` · ${formatJourCourt(colle.date)}` : ''}
                </ThemedText>
                <ThemedText type="small" style={{ color: colle.statut === 'faite' ? '#30A46C' : '#E5484D' }}>
                  {colle.statut === 'faite' ? 'faite' : 'non faite'}
                </ThemedText>
              </Pressable>
            )}
          </Section>
        )}
      </ScrollView>

      <ModaleCentree visible={edition !== null} onClose={() => setEdition(null)}>
        {edition && creneaux !== null && (
          <>
            <View style={styles.creneauEntete}>
              <Pressable onPress={() => setCreneaux(null)}>
                <ThemedText style={{ color: c.accent, fontWeight: '600' }}>‹ Retour</ThemedText>
              </Pressable>
              <ThemedText type="subtitle">Créneaux · {edition.prenom}</ThemedText>
            </View>
            {creneaux.length === 0 ? (
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                Aucun créneau trouvé sur les 2 prochaines semaines. Vérifie que l’emploi
                du temps de {edition.classe} est saisi (menu de la classe → Emploi du temps).
              </ThemedText>
            ) : (
              creneaux.map((cr, i) => (
                <Pressable
                  key={`${cr.date}-${cr.heureDebut}-${i}`}
                  onPress={() => appliquerCreneau(cr)}
                  style={[styles.creneau, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
                  <View style={{ flex: 1, gap: Spacing.half }}>
                    <ThemedText style={{ fontWeight: '700', textTransform: 'capitalize' }}>
                      {formatJourAvecSemaine(cr.date)} · {formatHeure(cr.heureDebut)}–{formatHeure(cr.heureFin)}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: c.textSecondary }}>
                      {texteSurveillance(cr.surveillance, cr.classe)} · {Math.round(cr.dureeMin / 60 * 10) / 10} h
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.badgeSurv,
                      { borderColor: cr.surveillance === 'vie_scolaire' ? '#30A46C' : c.accent },
                    ]}>
                    <ThemedText style={{ fontSize: 16 }}>
                      {cr.surveillance === 'vie_scolaire' ? '🏫' : '👥'}
                    </ThemedText>
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}

        {edition && creneaux === null && (
          <>
            <ThemedText type="subtitle">{edition.prenom}</ThemedText>

            <ThemedText style={styles.champLabel}>Date de la retenue</ThemedText>
            <View style={styles.dateLigne}>
              <TextInput
                value={editJm.jour}
                onChangeText={(jour) => {
                  setEditJm({ ...editJm, jour });
                  effacerCreneau();
                }}
                keyboardType="numeric"
                maxLength={2}
                placeholder="JJ"
                placeholderTextColor={c.textSecondary}
                style={[styles.champDate, { color: c.text, borderColor: c.border }]}
              />
              <ThemedText style={{ color: c.textSecondary }}>/</ThemedText>
              <TextInput
                value={editJm.mois}
                onChangeText={(mois) => {
                  setEditJm({ ...editJm, mois });
                  effacerCreneau();
                }}
                keyboardType="numeric"
                maxLength={2}
                placeholder="MM"
                placeholderTextColor={c.textSecondary}
                style={[styles.champDate, { color: c.text, borderColor: c.border }]}
              />
              <ThemedText type="small" style={{ color: c.textSecondary, flex: 1 }}>
                {apercuDate}
              </ThemedText>
            </View>

            {editHeureDebut && (
              <View style={[styles.creneauChoisi, { borderColor: c.border }]}>
                <ThemedText type="small" style={{ flex: 1 }}>
                  {formatHeure(editHeureDebut)}
                  {editHeureFin ? `–${formatHeure(editHeureFin)}` : ''}
                  {'  ·  '}
                  {texteSurveillance(editSurveillance, editSurveillanceClasse)}
                </ThemedText>
                <Pressable onPress={effacerCreneau}>
                  <ThemedText type="small" style={{ color: c.textSecondary }}>
                    Effacer
                  </ThemedText>
                </Pressable>
              </View>
            )}

            <PressableScale
              onPress={chercherCreneaux}
              disabled={chargementCreneaux}
              style={[styles.trouver, { borderColor: c.accent, opacity: chargementCreneaux ? 0.5 : 1 }]}>
              <ThemedText style={{ color: c.accent, fontWeight: '700' }}>
                {chargementCreneaux ? 'Recherche…' : '🔎 Trouver un créneau'}
              </ThemedText>
            </PressableScale>

            <ThemedText style={styles.champLabel}>Motif</ThemedText>
            <TextInput
              value={editMotif}
              onChangeText={setEditMotif}
              multiline
              placeholder="Motif de la retenue…"
              placeholderTextColor={c.textSecondary}
              style={[styles.champMotif, { color: c.text, borderColor: c.border }]}
            />

            <PressableScale
              onPress={enregistrerEdition}
              style={[styles.enregistrer, { backgroundColor: c.accent }]}>
              <ThemedText style={{ color: c.accentText, fontWeight: '600' }}>Enregistrer</ThemedText>
            </PressableScale>
          </>
        )}
      </ModaleCentree>
    </ThemedView>
  );
}

/** "2026-12-03" -> { jour: "3", mois: "12" } */
function jourMois(dateISO: string) {
  const [, m, j] = dateISO.split('-');
  return { jour: String(Number(j)), mois: String(Number(m)) };
}

function Section({
  titre,
  sousTitre,
  colles,
  children,
}: {
  titre: string;
  sousTitre?: string;
  colles: Colle[];
  children: (colle: Colle) => React.ReactNode;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  if (colles.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionEntete}>
        <ThemedText style={styles.sectionTitre}>{titre}</ThemedText>
        <View style={[styles.compteur, { backgroundColor: c.backgroundSelected }]}>
          <ThemedText type="small">{colles.length}</ThemedText>
        </View>
        {sousTitre && (
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            · {sousTitre}
          </ThemedText>
        )}
      </View>
      {colles.map(children)}
    </View>
  );
}

function CarteColle({
  colle,
  c,
  onPress,
  onLong,
  children,
}: {
  colle: Colle;
  c: ThemeColors;
  onPress?: () => void;
  onLong: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLong}
      style={[styles.carte, { backgroundColor: c.backgroundElement, borderColor: c.border }, CardShadow]}>
      <View style={styles.carteEntete}>
        <View style={[styles.pastille, { backgroundColor: colle.couleur }]} />
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.nom}>
            {colle.prenom} {colle.nom.toLocaleUpperCase('fr-FR')}
          </ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            {colle.classe}
            {colle.date ? ` · ${formatJourCourt(colle.date)}` : ' · date à définir'}
            {colle.heureDebut ? ` · ${formatHeure(colle.heureDebut)}` : ''}
          </ThemedText>
        </View>
      </View>
      {colle.heureDebut && texteSurveillance(colle.surveillance, colle.surveillanceClasse) ? (
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {texteSurveillance(colle.surveillance, colle.surveillanceClasse)}
        </ThemedText>
      ) : null}
      {colle.motif ? <ThemedText type="small">{colle.motif}</ThemedText> : null}
      {children}
    </Pressable>
  );
}

function Etape({
  label,
  actif,
  couleur,
  onPress,
}: {
  label: string;
  actif: boolean;
  couleur: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.etape,
        { borderColor: actif ? '#30A46C' : couleur.border, backgroundColor: actif ? '#30A46C' : 'transparent' },
      ]}>
      <ThemedText type="small" style={{ color: actif ? '#fff' : couleur.text }}>
        {actif ? '✓ ' : ''}
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  liste: { padding: Spacing.three, gap: Spacing.four },
  vide: { textAlign: 'center', marginTop: Spacing.six },
  section: { gap: Spacing.two },
  sectionEntete: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionTitre: { fontSize: 18, fontWeight: '800' },
  compteur: { minWidth: 24, alignItems: 'center', paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 999 },
  carte: {
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  carteEntete: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pastille: { width: 12, height: 12, borderRadius: 6 },
  nom: { fontSize: 16, fontWeight: '600' },
  etapes: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  etape: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  actionBtn: { flex: 1, paddingVertical: Spacing.three, borderRadius: Radius.s, alignItems: 'center' },
  actionTexte: { color: '#fff', fontSize: 15, fontWeight: '700' },
  carteFinie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.s,
    borderWidth: StyleSheet.hairlineWidth,
  },
  champLabel: { fontSize: 15, fontWeight: '700', marginTop: Spacing.one },
  dateLigne: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  champDate: {
    width: 52,
    borderWidth: 1,
    borderRadius: Radius.s,
    padding: Spacing.two,
    fontSize: 18,
    textAlign: 'center',
  },
  champMotif: {
    borderWidth: 1,
    borderRadius: Radius.s,
    padding: Spacing.three,
    fontSize: 16,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  enregistrer: { padding: Spacing.three, borderRadius: Radius.s, alignItems: 'center', marginTop: Spacing.two },

  trouver: {
    padding: Spacing.three,
    borderRadius: Radius.s,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  creneauChoisi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.s,
    borderWidth: 1,
    marginTop: Spacing.two,
  },
  creneauEntete: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  creneau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.s,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeSurv: {
    width: 40,
    height: 40,
    borderRadius: Radius.s,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

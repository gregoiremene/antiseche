import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModaleCentree } from '@/components/modale-centree';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { texteSurCouleur } from '@/constants/couleurs';
import { CardShadow, Colors, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { db } from '@/db';
import { selectElevesOrdonnes } from '@/db/eleves';
import { definirDisposition, placerEleve, retirerEleve, selectPlaces } from '@/db/plan';
import { classes } from '@/db/schema';
import { type Colonne, DEFAUT_ESPACEMENT, nbTables, slotId } from '@/lib/plan-classe';

const TABLE_W = 82;
const TABLE_H = 50;

export default function EcranPlan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classeId = Number(id);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  // cet écran se vit en paysage ; on remet le portrait en sortant
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const { data: infosClasse } = useLiveQuery(
    db.select({ nom: classes.nom, couleur: classes.couleur, planColonnes: classes.planColonnes }).from(classes).where(eq(classes.id, classeId)),
    [classeId],
  );
  const classe = infosClasse?.[0];
  const colonnes = classe?.planColonnes ?? null;

  const { data: eleves } = useLiveQuery(selectElevesOrdonnes(classeId), [classeId]);
  const { data: placesData } = useLiveQuery(selectPlaces(classeId), [classeId]);

  // slot → élève placé ; et ensemble des inscriptions placées
  const parSlot = useMemo(() => {
    const m = new Map<string, { inscriptionId: number; nom: string; prenom: string }>();
    for (const p of placesData ?? []) m.set(p.slot, p);
    return m;
  }, [placesData]);
  const placees = useMemo(() => new Set((placesData ?? []).map((p) => p.inscriptionId)), [placesData]);

  const [slotActif, setSlotActif] = useState<string | null>(null);
  const [configVisible, setConfigVisible] = useState(false);

  const total = eleves?.length ?? 0;
  const nbPlaces = placesData?.length ?? 0;

  async function choisir(inscriptionId: number) {
    if (!slotActif) return;
    await placerEleve(classeId, inscriptionId, slotActif);
    setSlotActif(null);
  }
  async function viderTable() {
    const occ = slotActif ? parSlot.get(slotActif) : undefined;
    if (occ) await retirerEleve(occ.inscriptionId);
    setSlotActif(null);
  }

  // --- pas encore de plan : formulaire de création ---
  if (!colonnes) {
    return (
      <ThemedView style={styles.page}>
        <Stack.Screen options={{ headerShown: false }} />
        <BoutonRetour c={c} top={insets.top} left={insets.left} />
        <CreationPlan c={c} onCreer={(cols) => definirDisposition(classeId, cols)} />
      </ThemedView>
    );
  }

  const occupantActif = slotActif ? parSlot.get(slotActif) : undefined;

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* grille : colonnes centrées, tables collées dans une colonne */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.grilleScroll}
        contentContainerStyle={[
          styles.grille,
          { paddingTop: insets.top + 44, paddingLeft: Spacing.four + insets.left, paddingRight: Spacing.four + insets.right },
        ]}>
        {colonnes.map((col, ci) => (
          <View key={ci} style={{ gap: col.espacement ?? DEFAUT_ESPACEMENT }}>
            {/* du fond (hauteur-1, en haut) vers le devant (0, en bas, près du tableau) */}
            {Array.from({ length: col.hauteur }, (_, k) => col.hauteur - 1 - k).map((y) => (
              <View key={y} style={styles.rang}>
                {Array.from({ length: col.largeur }, (_, x) => {
                  const slot = slotId(ci, x, y);
                  const occ = parSlot.get(slot);
                  const fond = occ ? (classe?.couleur ?? c.accent) : c.backgroundElement;
                  const txt = occ ? texteSurCouleur(classe?.couleur ?? c.accent) : c.textSecondary;
                  return (
                    <Pressable
                      key={x}
                      onPress={() => setSlotActif(slot)}
                      style={[
                        styles.table,
                        {
                          backgroundColor: fond,
                          borderColor: occ ? fond : c.border,
                          borderStyle: occ ? 'solid' : 'dashed',
                        },
                      ]}>
                      {occ ? (
                        <>
                          <ThemedText numberOfLines={1} style={{ color: txt, fontSize: 14, fontWeight: '800' }}>
                            {occ.prenom}
                          </ThemedText>
                          <ThemedText numberOfLines={1} style={{ color: txt, fontSize: 11 }}>
                            {occ.nom.toLocaleUpperCase('fr-FR')}
                          </ThemedText>
                        </>
                      ) : (
                        <ThemedText style={{ color: c.textSecondary, fontSize: 22 }}>+</ThemedText>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* contrôles flottants : retour (haut gauche) + disposition (haut droite) */}
      <BoutonRetour c={c} top={insets.top} left={insets.left} />
      <PressableScale
        onPress={() => setConfigVisible(true)}
        style={[
          styles.dispoFlottant,
          { backgroundColor: c.backgroundElement, borderColor: c.border, top: insets.top + Spacing.one, right: Spacing.three + insets.right },
        ]}>
        <ThemedText style={{ color: c.accent, fontWeight: '700' }}>Disposition</ThemedText>
      </PressableScale>

      {/* compteur discret en bas à gauche */}
      <ThemedText
        type="small"
        style={[
          styles.compteur,
          { color: nbPlaces < total ? c.textSecondary : c.text, bottom: Spacing.two + insets.bottom, left: Spacing.three + insets.left },
        ]}>
        {nbPlaces} / {total} placés
      </ThemedText>

      {/* modale d'assignation d'une table */}
      <ModaleCentree
        visible={slotActif !== null}
        onClose={() => setSlotActif(null)}
        footer={
          occupantActif ? (
            <PressableScale onPress={viderTable} style={[styles.retirer, { borderColor: c.border }]}>
              <ThemedText style={{ color: '#E5484D', fontWeight: '700' }}>Retirer {occupantActif.prenom} de cette table</ThemedText>
            </PressableScale>
          ) : undefined
        }>
        <ThemedText type="subtitle">{occupantActif ? 'Changer d’élève' : 'Placer un élève'}</ThemedText>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          Déjà placé → échange les deux tables.
        </ThemedText>
        <View style={styles.grilleEleves}>
          {(eleves ?? []).map((e) => {
            const dejaPlace = placees.has(e.inscriptionId);
            const estLui = occupantActif?.inscriptionId === e.inscriptionId;
            return (
              <Pressable
                key={e.inscriptionId}
                onPress={() => choisir(e.inscriptionId)}
                style={[
                  styles.tuile,
                  {
                    backgroundColor: estLui ? c.backgroundSelected : dejaPlace ? c.backgroundElement : 'transparent',
                    borderColor: estLui ? c.accent : c.border,
                  },
                ]}>
                <ThemedText style={{ color: c.text, fontWeight: '700' }} numberOfLines={1}>
                  {e.prenom}
                </ThemedText>
                <ThemedText style={{ fontSize: 10, color: c.textSecondary }} numberOfLines={1}>
                  {e.nom.toLocaleUpperCase('fr-FR')}
                </ThemedText>
                {(estLui || dejaPlace) && (
                  <ThemedText style={{ fontSize: 9, fontWeight: '700', color: estLui ? c.accent : c.textSecondary }}>
                    {estLui ? 'ici' : 'placé'}
                  </ThemedText>
                )}
              </Pressable>
            );
          })}
        </View>
      </ModaleCentree>

      {/* modale de disposition */}
      <ConfigDisposition
        visible={configVisible}
        c={c}
        colonnes={colonnes}
        onFermer={() => setConfigVisible(false)}
        onEnregistrer={(cols) => {
          definirDisposition(classeId, cols);
          setConfigVisible(false);
        }}
      />
    </ThemedView>
  );
}

/** Flèche de retour flottante (header masqué pour gagner de la place). */
function BoutonRetour({ c, top, left }: { c: ThemeColors; top: number; left: number }) {
  return (
    <PressableScale
      onPress={() => router.back()}
      style={[
        styles.retour,
        { backgroundColor: c.backgroundElement, borderColor: c.border, top: top + Spacing.one, left: Spacing.three + left },
      ]}>
      <ThemedText style={{ color: c.text, fontSize: 22, fontWeight: '700', marginTop: -2 }}>‹</ThemedText>
    </PressableScale>
  );
}

/** Formulaire de première création : nb de colonnes + profondeur par défaut. */
function CreationPlan({ c, onCreer }: { c: ThemeColors; onCreer: (cols: Colonne[]) => void }) {
  const [nbCol, setNbCol] = useState(3);
  const [hauteur, setHauteur] = useState(3);
  return (
    <View style={styles.creation}>
      <ThemedText type="subtitle">Créer le plan</ThemedText>
      <ThemedText type="small" style={{ color: c.textSecondary }}>
        On part de colonnes de 2 tables de large ; tu ajusteras chaque colonne ensuite (« Disposition »).
      </ThemedText>
      <Stepper c={c} label="Colonnes" valeur={nbCol} min={1} max={8} onChange={setNbCol} />
      <Stepper c={c} label="Rangs par colonne" valeur={hauteur} min={1} max={10} onChange={setHauteur} />
      <PressableScale
        onPress={() => onCreer(Array.from({ length: nbCol }, () => ({ largeur: 2, hauteur })))}
        style={[styles.boutonPlein, { backgroundColor: c.accent }]}>
        <ThemedText style={{ color: c.accentText, fontWeight: '700' }}>Créer le plan</ThemedText>
      </PressableScale>
    </View>
  );
}

/** Édition de la disposition : largeur/hauteur par colonne, ajout/suppression. */
function ConfigDisposition({
  visible,
  c,
  colonnes,
  onFermer,
  onEnregistrer,
}: {
  visible: boolean;
  c: ThemeColors;
  colonnes: Colonne[];
  onFermer: () => void;
  onEnregistrer: (cols: Colonne[]) => void;
}) {
  const [cols, setCols] = useState<Colonne[]>(colonnes);
  useEffect(() => {
    if (visible) setCols(colonnes);
  }, [visible, colonnes]);

  function maj(i: number, champ: 'largeur' | 'hauteur', delta: number) {
    setCols((prec) =>
      prec.map((col, k) => (k === i ? { ...col, [champ]: Math.max(1, col[champ] + delta) } : col)),
    );
  }

  return (
    <ModaleCentree
      visible={visible}
      onClose={onFermer}
      footer={
        <PressableScale onPress={() => onEnregistrer(cols)} style={[styles.boutonPlein, { backgroundColor: c.accent }]}>
          <ThemedText style={{ color: c.accentText, fontWeight: '700' }}>
            Enregistrer ({nbTables(cols)} tables)
          </ThemedText>
        </PressableScale>
      }>
      <ThemedText type="subtitle">Disposition</ThemedText>
      <ThemedText type="small" style={{ color: c.textSecondary }}>
        Réduire une colonne libère les tables en trop.
      </ThemedText>
      <Stepper
        c={c}
        label="Espacement des rangs"
        valeur={cols[0]?.espacement ?? DEFAUT_ESPACEMENT}
        min={0}
        max={40}
        pas={2}
        onChange={(v) => setCols((p) => p.map((col) => ({ ...col, espacement: v })))}
      />
      {cols.map((col, i) => (
        <View key={i} style={[styles.colConfig, { borderColor: c.border }]}>
          <ThemedText style={{ fontWeight: '700', width: 72 }}>Colonne {i + 1}</ThemedText>
          <Stepper c={c} label="larg." valeur={col.largeur} min={1} max={6} onChange={(v) => maj(i, 'largeur', v - col.largeur)} compact />
          <Stepper c={c} label="haut." valeur={col.hauteur} min={1} max={10} onChange={(v) => maj(i, 'hauteur', v - col.hauteur)} compact />
          <Pressable onPress={() => setCols((p) => p.filter((_, k) => k !== i))} hitSlop={8}>
            <ThemedText style={{ color: '#E5484D', fontWeight: '700' }}>✕</ThemedText>
          </Pressable>
        </View>
      ))}
      <Pressable
        onPress={() => setCols((p) => [...p, { largeur: 2, hauteur: p[0]?.hauteur ?? 3 }])}
        style={[styles.ajoutCol, { borderColor: c.border }]}>
        <ThemedText style={{ color: c.accent, fontWeight: '700' }}>+ Ajouter une colonne</ThemedText>
      </Pressable>
    </ModaleCentree>
  );
}

/** Petit sélecteur −/valeur/+ réutilisé par la création et la config. */
function Stepper({
  c,
  label,
  valeur,
  min,
  max,
  onChange,
  compact = false,
  pas = 1,
}: {
  c: ThemeColors;
  label: string;
  valeur: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  compact?: boolean;
  pas?: number;
}) {
  return (
    <View style={[styles.stepper, compact && { flex: 0 }]}>
      {!compact && <ThemedText style={{ flex: 1, fontWeight: '600' }}>{label}</ThemedText>}
      {compact && <ThemedText type="small" style={{ color: c.textSecondary }}>{label}</ThemedText>}
      <Pressable
        onPress={() => onChange(Math.max(min, valeur - pas))}
        style={[styles.pasBouton, { borderColor: c.border }]}>
        <ThemedText style={{ fontSize: 18, fontWeight: '700', color: c.text }}>−</ThemedText>
      </Pressable>
      <ThemedText style={{ minWidth: 22, textAlign: 'center', fontWeight: '800' }}>{valeur}</ThemedText>
      <Pressable
        onPress={() => onChange(Math.min(max, valeur + pas))}
        style={[styles.pasBouton, { borderColor: c.border }]}>
        <ThemedText style={{ fontSize: 18, fontWeight: '700', color: c.text }}>+</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  grilleScroll: { flex: 1 },
  grille: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  compteur: { position: 'absolute', left: Spacing.three, fontWeight: '700' },
  retour: {
    position: 'absolute',
    left: Spacing.three,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...CardShadow,
  },
  dispoFlottant: {
    position: 'absolute',
    right: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 38,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...CardShadow,
  },
  rang: { flexDirection: 'row' },
  table: {
    width: TABLE_W,
    height: TABLE_H,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  // création / config
  creation: { padding: Spacing.four, paddingTop: 56, gap: Spacing.three },
  boutonPlein: { padding: Spacing.three, borderRadius: Radius.s, alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pasBouton: { width: 34, height: 34, borderRadius: Radius.s, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  colConfig: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  ajoutCol: { padding: Spacing.three, borderRadius: Radius.s, borderWidth: 1, alignItems: 'center', marginTop: Spacing.one },
  // modale placement
  grilleEleves: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  tuile: {
    flexGrow: 1,
    flexBasis: 90,
    minWidth: 90,
    maxWidth: '48%',
    minHeight: 46,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.s,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retirer: { padding: Spacing.three, borderRadius: Radius.s, borderWidth: 1, alignItems: 'center' },
});

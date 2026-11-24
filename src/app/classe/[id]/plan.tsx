import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useColorScheme, View } from 'react-native';

import { ModaleCentree } from '@/components/modale-centree';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { texteSurCouleur } from '@/constants/couleurs';
import { Colors, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { db } from '@/db';
import { selectElevesOrdonnes } from '@/db/eleves';
import { definirDisposition, placerEleve, retirerEleve, selectPlaces } from '@/db/plan';
import { classes } from '@/db/schema';
import { type Colonne, nbTables, slotId } from '@/lib/plan-classe';

const TABLE_W = 58;
const TABLE_H = 42;

export default function EcranPlan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classeId = Number(id);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];

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
  const [recherche, setRecherche] = useState('');
  const [configVisible, setConfigVisible] = useState(false);

  const total = eleves?.length ?? 0;
  const nbPlaces = placesData?.length ?? 0;

  async function choisir(inscriptionId: number) {
    if (!slotActif) return;
    await placerEleve(classeId, inscriptionId, slotActif);
    setSlotActif(null);
    setRecherche('');
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
        <Stack.Screen options={{ title: classe?.nom ? `Plan · ${classe.nom}` : 'Plan de classe' }} />
        <CreationPlan c={c} onCreer={(cols) => definirDisposition(classeId, cols)} />
      </ThemedView>
    );
  }

  const occupantActif = slotActif ? parSlot.get(slotActif) : undefined;
  const filtres = (eleves ?? []).filter((e) => {
    const q = recherche.trim().toLocaleLowerCase('fr-FR');
    return !q || `${e.prenom} ${e.nom}`.toLocaleLowerCase('fr-FR').includes(q);
  });
  // non placés d'abord, puis placés (pour échanger)
  const tries = [...filtres].sort((a, b) => Number(placees.has(a.inscriptionId)) - Number(placees.has(b.inscriptionId)));

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen
        options={{
          title: classe?.nom ? `Plan · ${classe.nom}` : 'Plan de classe',
          headerRight: () => (
            <Pressable onPress={() => setConfigVisible(true)} hitSlop={8}>
              <ThemedText style={{ color: c.accent, fontWeight: '700' }}>Disposition</ThemedText>
            </Pressable>
          ),
        }}
      />

      <View style={styles.barre}>
        <ThemedText type="small" style={{ color: nbPlaces < total ? c.textSecondary : c.text, fontWeight: '700' }}>
          {nbPlaces} / {total} élèves placés
        </ThemedText>
      </View>

      {/* grille : colonnes centrées, tables collées dans une colonne, tableau en bas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.grille}>
        {colonnes.map((col, ci) => (
          <View key={ci} style={styles.colonne}>
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
                          <ThemedText numberOfLines={1} style={{ color: txt, fontSize: 11, fontWeight: '800' }}>
                            {occ.prenom}
                          </ThemedText>
                          <ThemedText numberOfLines={1} style={{ color: txt, fontSize: 9 }}>
                            {occ.nom.toLocaleUpperCase('fr-FR')}
                          </ThemedText>
                        </>
                      ) : (
                        <ThemedText style={{ color: c.textSecondary, fontSize: 16 }}>+</ThemedText>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* le tableau, en bas (vue du prof face aux élèves) */}
      <View style={[styles.tableau, { borderColor: c.border, backgroundColor: c.backgroundElement }]}>
        <ThemedText style={{ color: c.textSecondary, fontWeight: '800', letterSpacing: 2 }}>TABLEAU</ThemedText>
      </View>

      {/* modale d'assignation d'une table */}
      <ModaleCentree
        visible={slotActif !== null}
        onClose={() => {
          setSlotActif(null);
          setRecherche('');
        }}
        footer={
          occupantActif ? (
            <PressableScale onPress={viderTable} style={[styles.retirer, { borderColor: c.border }]}>
              <ThemedText style={{ color: '#E5484D', fontWeight: '700' }}>Retirer {occupantActif.prenom} de cette table</ThemedText>
            </PressableScale>
          ) : undefined
        }>
        <ThemedText type="subtitle">{occupantActif ? 'Changer d’élève' : 'Placer un élève'}</ThemedText>
        <TextInput
          value={recherche}
          onChangeText={setRecherche}
          placeholder="Chercher un élève…"
          placeholderTextColor={c.textSecondary}
          style={[styles.champ, { color: c.text, borderColor: c.border }]}
        />
        {tries.map((e) => {
          const dejaPlace = placees.has(e.inscriptionId);
          const estLui = occupantActif?.inscriptionId === e.inscriptionId;
          return (
            <Pressable
              key={e.inscriptionId}
              onPress={() => choisir(e.inscriptionId)}
              style={[styles.eleveLigne, { borderColor: c.border, backgroundColor: estLui ? c.backgroundSelected : 'transparent' }]}>
              <ThemedText style={{ color: c.text, fontWeight: '600' }} numberOfLines={1}>
                {e.nom.toLocaleUpperCase('fr-FR')} {e.prenom}
              </ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {estLui ? 'ici' : dejaPlace ? 'placé — échanger' : 'à placer'}
              </ThemedText>
            </Pressable>
          );
        })}
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

  function maj(i: number, champ: keyof Colonne, delta: number) {
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
}: {
  c: ThemeColors;
  label: string;
  valeur: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.stepper, compact && { flex: 0 }]}>
      {!compact && <ThemedText style={{ flex: 1, fontWeight: '600' }}>{label}</ThemedText>}
      {compact && <ThemedText type="small" style={{ color: c.textSecondary }}>{label}</ThemedText>}
      <Pressable
        onPress={() => onChange(Math.max(min, valeur - 1))}
        style={[styles.pasBouton, { borderColor: c.border }]}>
        <ThemedText style={{ fontSize: 18, fontWeight: '700', color: c.text }}>−</ThemedText>
      </Pressable>
      <ThemedText style={{ minWidth: 22, textAlign: 'center', fontWeight: '800' }}>{valeur}</ThemedText>
      <Pressable
        onPress={() => onChange(Math.min(max, valeur + 1))}
        style={[styles.pasBouton, { borderColor: c.border }]}>
        <ThemedText style={{ fontSize: 18, fontWeight: '700', color: c.text }}>+</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  barre: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, alignItems: 'center' },
  grille: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  colonne: { gap: Spacing.two },
  rang: { flexDirection: 'row' },
  table: {
    width: TABLE_W,
    height: TABLE_H,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tableau: {
    margin: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  // création / config
  creation: { padding: Spacing.four, gap: Spacing.three },
  boutonPlein: { padding: Spacing.three, borderRadius: Radius.s, alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pasBouton: { width: 34, height: 34, borderRadius: Radius.s, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  colConfig: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  ajoutCol: { padding: Spacing.three, borderRadius: Radius.s, borderWidth: 1, alignItems: 'center', marginTop: Spacing.one },
  // modale placement
  champ: { borderWidth: 1, borderRadius: Radius.s, padding: Spacing.three, fontSize: 16 },
  eleveLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.s,
    borderWidth: StyleSheet.hairlineWidth,
  },
  retirer: { padding: Spacing.three, borderRadius: Radius.s, borderWidth: 1, alignItems: 'center' },
});

import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
import { MenuActions } from '@/components/menu-actions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { db } from '@/db';
import { ajouterEleves, supprimerEleve } from '@/db/eleves';
import { useAmenagementsVisibles } from '@/hooks/use-amenagements-visibles';
import { classes, eleves, inscriptions } from '@/db/schema';
import { parseListeEleves } from '@/lib/import-eleves';

export default function EcranClasse() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classeId = Number(id);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  const [modalVisible, setModalVisible] = useState(false);
  const [texte, setTexte] = useState('');
  const { visibles: amenagementsVisibles, basculer: basculerAmenagements } =
    useAmenagementsVisibles();

  const { data: infosClasse } = useLiveQuery(
    db.select().from(classes).where(eq(classes.id, classeId)),
    [classeId],
  );
  const classe = infosClasse?.[0];

  const { data: liste } = useLiveQuery(
    db
      .select({
        eleveId: eleves.id,
        nom: eleves.nom,
        prenom: eleves.prenom,
        amenagements: eleves.amenagements,
      })
      .from(inscriptions)
      .innerJoin(eleves, eq(eleves.id, inscriptions.eleveId))
      .where(eq(inscriptions.classeId, classeId))
      .orderBy(asc(eleves.nom), asc(eleves.prenom)),
    [classeId],
  );

  const apercu = parseListeEleves(texte);
  const nbEleves = liste?.length ?? 0;

  async function importer() {
    if (apercu.length === 0) return;
    const { ajoutes, ignores } = await ajouterEleves(classeId, apercu);
    setTexte('');
    setModalVisible(false);
    Alert.alert(
      'Import terminé',
      ignores > 0
        ? `${ajoutes} élève(s) ajouté(s), ${ignores} déjà présent(s).`
        : `${ajoutes} élève(s) ajouté(s).`,
    );
  }

  function confirmerSuppression(eleveId: number, nomComplet: string) {
    Alert.alert(
      `Supprimer ${nomComplet} ?`,
      'Sa fiche, ses notes et ses observations seront perdues.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => supprimerEleve(eleveId) },
      ],
    );
  }

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen
        options={{
          title: classe?.nom ?? 'Classe',
          headerRight: () => (
            <MenuActions
              actions={[
                {
                  label: amenagementsVisibles
                    ? 'Masquer les aménagements'
                    : 'Afficher les aménagements',
                  onPress: basculerAmenagements,
                },
                {
                  label: 'Notes et évaluations',
                  onPress: () =>
                    router.push({
                      pathname: '/classe/[id]/evaluations',
                      params: { id: String(classeId) },
                    }),
                },
                { label: 'Ajouter des élèves', onPress: () => setModalVisible(true) },
              ]}
            />
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.liste, { paddingBottom: 140 + insets.bottom }]}>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {nbEleves} élève{nbEleves > 1 ? 's' : ''}
        </ThemedText>

        {nbEleves === 0 && (
          <ThemedText style={[styles.vide, { color: c.textSecondary }]}>
            Aucun élève.{'\n'}Menu ⋯ en haut à droite pour coller ta liste.
          </ThemedText>
        )}

        {liste?.map((e) => (
          <Pressable
            key={e.eleveId}
            onPress={() =>
              router.push({ pathname: '/eleve/[id]', params: { id: String(e.eleveId) } })
            }
            onLongPress={() => confirmerSuppression(e.eleveId, `${e.prenom} ${e.nom}`)}
            style={({ pressed }) => [
              styles.carte,
              { backgroundColor: pressed ? c.backgroundSelected : c.backgroundElement },
            ]}>
            <View
              style={[styles.initiales, { backgroundColor: classe?.couleur ?? c.backgroundSelected }]}>
              <ThemedText style={styles.initialesTexte}>
                {(e.prenom[0] ?? '') + (e.nom[0] ?? '')}
              </ThemedText>
            </View>
            <View style={styles.carteTexte}>
              <ThemedText style={styles.nomEleve}>
                {e.nom.toLocaleUpperCase('fr-FR')} {e.prenom}
              </ThemedText>
              <BadgesAmenagements amenagements={e.amenagements} />
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Saisie rapide en pleine largeur : c'est l'action qu'on fait plusieurs
          fois par jour, elle mérite la place et le bas de l'écran (pouce). */}
      {nbEleves > 0 && (
        <Pressable
          onPress={() =>
            router.push({ pathname: '/classe/[id]/saisie', params: { id: String(classeId) } })
          }
          style={[
            styles.barreSaisie,
            { backgroundColor: classe?.couleur ?? c.text, bottom: Spacing.four + insets.bottom },
          ]}>
          <ThemedText style={styles.barreSaisieTexte}>Saisie rapide</ThemedText>
        </Pressable>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <Pressable style={styles.fond} onPress={() => setModalVisible(false)} />
        <ThemedView
          type="backgroundElement"
          style={[styles.feuille, { paddingBottom: Spacing.five + insets.bottom }]}>
          <ThemedText type="subtitle">Coller une liste</ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            Un élève par ligne. « DUPONT Jean », « Dupont, Jean » ou une colonne
            copiée depuis un tableur : les trois marchent.
          </ThemedText>

          <TextInput
            value={texte}
            onChangeText={setTexte}
            placeholder={'DUPONT Jean\nMARTIN Léa\n…'}
            placeholderTextColor={c.textSecondary}
            multiline
            autoFocus
            style={[styles.champ, { color: c.text, borderColor: c.backgroundSelected }]}
          />

          <ThemedText type="small" style={{ color: c.textSecondary }}>
            {apercu.length === 0
              ? 'Aucun élève détecté pour l’instant.'
              : `${apercu.length} élève(s) détecté(s) — ex. : ${apercu[0].nom.toLocaleUpperCase('fr-FR')} ${apercu[0].prenom}`}
          </ThemedText>

          <Pressable
            onPress={importer}
            disabled={apercu.length === 0}
            style={[styles.bouton, { backgroundColor: c.text, opacity: apercu.length ? 1 : 0.4 }]}>
            <ThemedText style={[styles.nomEleve, { color: c.background }]}>
              Importer {apercu.length > 0 ? `(${apercu.length})` : ''}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  liste: { padding: Spacing.three, gap: Spacing.two, paddingBottom: 120 },
  vide: { textAlign: 'center', marginTop: Spacing.six },
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    paddingRight: Spacing.three,
    borderRadius: Spacing.three,
  },
  initiales: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialesTexte: { color: '#fff', fontWeight: '700' },
  carteTexte: { gap: Spacing.half, flex: 1 },
  nomEleve: { fontSize: 16, fontWeight: '600' },
  barreSaisie: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.four,
    height: 56,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barreSaisieTexte: { color: '#fff', fontSize: 17, fontWeight: '700' },
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  feuille: {
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  champ: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
    minHeight: 140,
    maxHeight: 260,
    textAlignVertical: 'top',
  },
  bouton: { padding: Spacing.three, borderRadius: Spacing.two, alignItems: 'center' },
});

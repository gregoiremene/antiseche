import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarEleve } from '@/components/avatar-eleve';
import { BadgesAmenagements } from '@/components/badges-amenagements';
import { FadeIn } from '@/components/fade-in';
import { MenuActions } from '@/components/menu-actions';
import { ModaleCentree } from '@/components/modale-centree';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, Colors, Radius, Spacing } from '@/constants/theme';
import { db } from '@/db';
import { ajouterEleves, selectElevesOrdonnes, supprimerEleve } from '@/db/eleves';
import { useAmenagementsVisibles } from '@/hooks/use-amenagements-visibles';
import { classes } from '@/db/schema';
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

  // ordre de saisie, pas alphabétique (modifiable via « Réordonner »)
  const { data: liste } = useLiveQuery(selectElevesOrdonnes(classeId), [classeId]);

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
      <Stack.Screen options={{ title: classe?.nom ?? 'Classe' }} />

      <ScrollView
        contentContainerStyle={[styles.liste, { paddingBottom: 150 + insets.bottom }]}>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {nbEleves} élève{nbEleves > 1 ? 's' : ''}
        </ThemedText>

        {nbEleves === 0 && (
          <ThemedText style={[styles.vide, { color: c.textSecondary }]}>
            Aucun élève.{'\n'}Bouton ⋯ en bas à droite pour coller ta liste.
          </ThemedText>
        )}

        {liste?.map((e, i) => (
          <FadeIn key={e.eleveId} delay={Math.min(i * 30, 300)}>
            <PressableScale
              onPress={() =>
                router.push({ pathname: '/eleve/[id]', params: { id: String(e.eleveId) } })
              }
              onLongPress={() => confirmerSuppression(e.eleveId, `${e.prenom} ${e.nom}`)}
              style={[
                styles.carte,
                { backgroundColor: c.backgroundElement, borderColor: c.border },
                CardShadow,
              ]}>
              <AvatarEleve
                photoUri={e.photoUri}
                initiales={(e.prenom[0] ?? '') + (e.nom[0] ?? '')}
                taille={42}
                couleur={classe?.couleur ?? c.backgroundSelected}
              />
              <View style={styles.carteTexte}>
                <ThemedText style={styles.nomEleve}>
                  {e.nom.toLocaleUpperCase('fr-FR')} {e.prenom}
                </ThemedText>
                <BadgesAmenagements amenagements={e.amenagements} />
              </View>
            </PressableScale>
          </FadeIn>
        ))}
      </ScrollView>

      {/* Saisie rapide en pleine largeur : c'est l'action qu'on fait plusieurs
          fois par jour, elle mérite la place et le bas de l'écran (pouce). */}
      {nbEleves > 0 && (
        <PressableScale
          onPress={() =>
            router.push({ pathname: '/classe/[id]/saisie', params: { id: String(classeId) } })
          }
          style={[
            styles.barreSaisie,
            CardShadow,
            { backgroundColor: classe?.couleur ?? c.accent, bottom: Spacing.four + insets.bottom },
          ]}>
          <ThemedText style={styles.barreSaisieTexte}>Saisie rapide</ThemedText>
        </PressableScale>
      )}

      {/* menu remonté au-dessus de la barre Saisie rapide quand elle est là */}
      <MenuActions
        bottomOffset={nbEleves > 0 ? 72 : 0}
        actions={[
          { label: 'Ajouter des élèves', onPress: () => setModalVisible(true) },
          {
            label: 'Réordonner les élèves',
            onPress: () =>
              router.push({ pathname: '/classe/[id]/ordre', params: { id: String(classeId) } }),
          },
          {
            label: 'Notes et évaluations',
            onPress: () =>
              router.push({ pathname: '/classe/[id]/evaluations', params: { id: String(classeId) } }),
          },
          {
            label: 'Emploi du temps',
            onPress: () =>
              router.push({ pathname: '/classe/[id]/edt', params: { id: String(classeId) } }),
          },
          {
            label: amenagementsVisibles ? 'Masquer les aménagements' : 'Afficher les aménagements',
            onPress: basculerAmenagements,
          },
        ]}
      />

      <ModaleCentree visible={modalVisible} onClose={() => setModalVisible(false)}>
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
          style={[styles.champ, { color: c.text, borderColor: c.border }]}
        />

        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {apercu.length === 0
            ? 'Aucun élève détecté pour l’instant.'
            : `${apercu.length} élève(s) détecté(s) — ex. : ${apercu[0].nom.toLocaleUpperCase('fr-FR')} ${apercu[0].prenom}`}
        </ThemedText>

        <PressableScale
          onPress={importer}
          disabled={apercu.length === 0}
          style={[styles.bouton, { backgroundColor: c.accent, opacity: apercu.length ? 1 : 0.4 }]}>
          <ThemedText style={[styles.nomEleve, { color: c.accentText }]}>
            Importer {apercu.length > 0 ? `(${apercu.length})` : ''}
          </ThemedText>
        </PressableScale>
      </ModaleCentree>
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
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: Radius.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barreSaisieTexte: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  champ: {
    borderWidth: 1,
    borderRadius: Radius.s,
    padding: Spacing.three,
    fontSize: 16,
    minHeight: 140,
    maxHeight: 260,
    textAlignVertical: 'top',
  },
  bouton: { padding: Spacing.three, borderRadius: Radius.s, alignItems: 'center' },
});

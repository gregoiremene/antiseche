import { count, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, useColorScheme, View } from 'react-native';

import { FadeIn } from '@/components/fade-in';
import { MenuActions } from '@/components/menu-actions';
import { ModaleCentree } from '@/components/modale-centree';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { db } from '@/db';
import { getOuCreerAnneeActive } from '@/db/annees';
import { classes, inscriptions } from '@/db/schema';

const COULEURS = ['#208AEF', '#E5484D', '#30A46C', '#F76B15', '#8E4EC6', '#0D9BA5'] as const;

export default function EcranClasses() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];

  const [annee, setAnnee] = useState<{ id: number; libelle: string } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [nom, setNom] = useState('');
  const [couleur, setCouleur] = useState<string>(COULEURS[0]);

  useEffect(() => {
    getOuCreerAnneeActive().then(setAnnee);
  }, []);

  const { data: mesClasses } = useLiveQuery(
    db
      .select({
        id: classes.id,
        nom: classes.nom,
        couleur: classes.couleur,
        nbEleves: count(inscriptions.id),
      })
      .from(classes)
      .leftJoin(inscriptions, eq(inscriptions.classeId, classes.id))
      .where(eq(classes.anneeId, annee?.id ?? -1))
      .groupBy(classes.id)
      .orderBy(classes.nom),
    [annee?.id],
  );

  async function ajouterClasse() {
    const nomPropre = nom.trim();
    if (!nomPropre || !annee) return;
    try {
      await db.insert(classes).values({ anneeId: annee.id, nom: nomPropre, couleur });
      setNom('');
      setCouleur(COULEURS[0]);
      setModalVisible(false);
    } catch {
      Alert.alert('Classe déjà existante', `« ${nomPropre} » existe déjà en ${annee.libelle}.`);
    }
  }

  function supprimerClasse(id: number, nomClasse: string) {
    Alert.alert(
      `Supprimer ${nomClasse} ?`,
      'Les élèves restent enregistrés, mais leurs notes et observations de cette classe seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => db.delete(classes).where(eq(classes.id, id)) },
      ],
    );
  }

  const vide = mesClasses?.length === 0;

  return (
    <ThemedView style={styles.page}>
      {/* contenu aligné en bas : la grille part du bas de l'écran */}
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="small" style={{ color: c.textSecondary, marginBottom: Spacing.two }}>
          Année {annee?.libelle ?? '…'}
        </ThemedText>

        {vide && (
          <ThemedText style={[styles.vide, { color: c.textSecondary }]}>
            Aucune classe pour l’instant.{'\n'}Bouton ⋯ en bas à droite pour en créer une.
          </ThemedText>
        )}

        <View style={styles.grille}>
          {mesClasses?.map((classe, i) => (
            <FadeIn key={classe.id} delay={i * 45} style={styles.caseGrille}>
              <PressableScale
                onPress={() => router.push({ pathname: '/classe/[id]', params: { id: String(classe.id) } })}
                onLongPress={() => supprimerClasse(classe.id, classe.nom)}
                style={[styles.carte, { backgroundColor: classe.couleur }]}>
                <ThemedText style={styles.nomClasse} numberOfLines={2}>
                  {classe.nom}
                </ThemedText>
                <ThemedText style={styles.nbEleves}>
                  {classe.nbEleves} {classe.nbEleves > 1 ? 'élèves' : 'élève'}
                </ThemedText>
              </PressableScale>
            </FadeIn>
          ))}
        </View>
      </ScrollView>

      <MenuActions
        actions={[
          { label: 'Nouvelle classe', onPress: () => setModalVisible(true) },
          { label: 'Colles', onPress: () => router.push('/colles') },
          { label: 'Matières', onPress: () => router.push('/matieres') },
          { label: 'Dates des trimestres', onPress: () => router.push('/trimestres') },
          { label: 'Sauvegarde / Restauration', onPress: () => router.push('/sauvegarde') },
        ]}
      />

      <ModaleCentree visible={modalVisible} onClose={() => setModalVisible(false)}>
        <ThemedText type="subtitle">Nouvelle classe</ThemedText>

        <TextInput
          value={nom}
          onChangeText={setNom}
          placeholder="4eB, 2nde 3, TG1…"
          placeholderTextColor={c.textSecondary}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={ajouterClasse}
          style={[styles.champ, { color: c.text, borderColor: c.border }]}
        />

        <View style={styles.couleurs}>
          {COULEURS.map((col) => (
            <Pressable
              key={col}
              onPress={() => setCouleur(col)}
              style={[
                styles.choixCouleur,
                { backgroundColor: col },
                couleur === col && { borderColor: c.text, borderWidth: 3 },
              ]}
            />
          ))}
        </View>

        <PressableScale
          onPress={ajouterClasse}
          disabled={!nom.trim()}
          style={[styles.bouton, { backgroundColor: c.accent, opacity: nom.trim() ? 1 : 0.4 }]}>
          <ThemedText style={[styles.boutonTexte, { color: c.accentText }]}>Créer</ThemedText>
        </PressableScale>
      </ModaleCentree>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  // flexGrow + justifyContent flex-end : peu de classes = collées en bas
  scroll: { flexGrow: 1, justifyContent: 'flex-end', padding: Spacing.three, paddingBottom: 120 },
  vide: { textAlign: 'center', marginBottom: Spacing.four },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  caseGrille: { width: '47.5%', flexGrow: 1 },
  carte: {
    aspectRatio: 1,
    borderRadius: Radius.l,
    padding: Spacing.three,
    justifyContent: 'flex-end',
    gap: Spacing.half,
  },
  nomClasse: { color: '#fff', fontSize: 24, fontWeight: '800' },
  nbEleves: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  champ: { borderWidth: 1, borderRadius: Radius.s, padding: Spacing.three, fontSize: 18 },
  couleurs: { flexDirection: 'row', gap: Spacing.three, justifyContent: 'center', flexWrap: 'wrap' },
  choixCouleur: { width: 36, height: 36, borderRadius: 18 },
  bouton: { padding: Spacing.three, borderRadius: Radius.s, alignItems: 'center' },
  boutonTexte: { fontSize: 16, fontWeight: '600' },
});

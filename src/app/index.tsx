import { count, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { MenuActions } from '@/components/menu-actions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { db } from '@/db';
import { getOuCreerAnneeActive } from '@/db/annees';
import { classes, inscriptions } from '@/db/schema';

const COULEURS = [
  '#208AEF',
  '#E5484D',
  '#30A46C',
  '#F76B15',
  '#8E4EC6',
  '#0D9BA5',
] as const;

export default function EcranClasses() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  // barre de navigation Android / barre de gestes
  const insets = useSafeAreaInsets();

  const [annee, setAnnee] = useState<{ id: number; libelle: string } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [nom, setNom] = useState('');
  const [couleur, setCouleur] = useState<string>(COULEURS[0]);

  useEffect(() => {
    getOuCreerAnneeActive().then(setAnnee);
  }, []);

  // -1 tant que l'année n'est pas chargée : la requête ne renvoie rien,
  // ce qui évite un hook conditionnel.
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
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => db.delete(classes).where(eq(classes.id, id)),
        },
      ],
    );
  }

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <MenuActions
              actions={[{ label: 'Nouvelle classe', onPress: () => setModalVisible(true) }]}
            />
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.liste, { paddingBottom: 120 + insets.bottom }]}>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          Année {annee?.libelle ?? '…'}
        </ThemedText>

        {mesClasses?.length === 0 && (
          <ThemedText style={[styles.vide, { color: c.textSecondary }]}>
            Aucune classe pour l’instant.{'\n'}Menu ⋯ en haut à droite pour en créer une.
          </ThemedText>
        )}

        {mesClasses?.map((classe) => (
          <Pressable
            key={classe.id}
            onPress={() =>
              router.push({ pathname: '/classe/[id]', params: { id: String(classe.id) } })
            }
            onLongPress={() => supprimerClasse(classe.id, classe.nom)}
            style={({ pressed }) => [
              styles.carte,
              { backgroundColor: pressed ? c.backgroundSelected : c.backgroundElement },
            ]}>
            <View style={[styles.pastille, { backgroundColor: classe.couleur }]} />
            <View style={styles.carteTexte}>
              <ThemedText style={styles.nomClasse}>{classe.nom}</ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {classe.nbEleves} {classe.nbEleves > 1 ? 'élèves' : 'élève'}
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <Pressable style={styles.fond} onPress={() => setModalVisible(false)} />
        <ThemedView
          type="backgroundElement"
          style={[styles.feuille, { paddingBottom: Spacing.six + insets.bottom }]}>
          <ThemedText type="subtitle">Nouvelle classe</ThemedText>

          <TextInput
            value={nom}
            onChangeText={setNom}
            placeholder="4eB, 2nde 3, TG1…"
            placeholderTextColor={c.textSecondary}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={ajouterClasse}
            style={[styles.champ, { color: c.text, borderColor: c.backgroundSelected }]}
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

          <Pressable
            onPress={ajouterClasse}
            disabled={!nom.trim()}
            style={[styles.bouton, { backgroundColor: c.text, opacity: nom.trim() ? 1 : 0.4 }]}>
            <ThemedText style={[styles.nomClasse, { color: c.background }]}>Créer</ThemedText>
          </Pressable>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  liste: { padding: Spacing.three, gap: Spacing.two },
  vide: { textAlign: 'center', marginTop: Spacing.six },
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  pastille: { width: 12, height: 40, borderRadius: 6 },
  carteTexte: { gap: Spacing.half },
  nomClasse: { fontSize: 17, fontWeight: '600' },
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  feuille: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  champ: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 18,
  },
  couleurs: { flexDirection: 'row', gap: Spacing.three, justifyContent: 'center' },
  choixCouleur: { width: 36, height: 36, borderRadius: 18 },
  bouton: { padding: Spacing.three, borderRadius: Spacing.two, alignItems: 'center' },
});

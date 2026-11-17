import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModaleCentree } from '@/components/modale-centree';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PALETTE, texteSurCouleur } from '@/constants/couleurs';
import { CardShadow, Colors, Radius, Spacing } from '@/constants/theme';
import { creerMatiere, majMatiere, selectMatieres, supprimerMatiere, type Matiere } from '@/db/matieres';

export default function EcranMatieres() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  const { data: matieres } = useLiveQuery(selectMatieres());

  // édition : une matière existante, ou null quand on en ajoute une
  const [edition, setEdition] = useState<Matiere | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [nom, setNom] = useState('');
  const [couleur, setCouleur] = useState<string>(PALETTE[0]);

  function ouvrirAjout() {
    setEdition(null);
    setNom('');
    setCouleur(PALETTE[0]);
    setModalVisible(true);
  }

  function ouvrirEdition(m: Matiere) {
    setEdition(m);
    setNom(m.nom);
    setCouleur(m.couleur);
    setModalVisible(true);
  }

  async function enregistrer() {
    const propre = nom.trim();
    if (!propre) return;
    try {
      if (edition) await majMatiere(edition.id, { nom: propre, couleur });
      else await creerMatiere(propre, couleur);
      setModalVisible(false);
    } catch {
      Alert.alert('Matière déjà existante', `« ${propre} » existe déjà.`);
    }
  }

  function confirmerSuppression(m: Matiere) {
    Alert.alert(
      `Supprimer ${m.nom} ?`,
      'Les cours qui l’utilisaient perdront leur matière (mais restent dans l’emploi du temps).',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => supprimerMatiere(m.id) },
      ],
    );
  }

  const vide = matieres?.length === 0;

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen options={{ title: 'Matières' }} />

      <ScrollView contentContainerStyle={[styles.liste, { paddingBottom: Spacing.six + insets.bottom }]}>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          Une couleur par matière pour repérer les cours dans l’emploi du temps.
        </ThemedText>

        {vide && (
          <ThemedText style={[styles.vide, { color: c.textSecondary }]}>
            Aucune matière pour l’instant.{'\n'}Ajoute-en une avec le bouton ci-dessous.
          </ThemedText>
        )}

        {matieres?.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => ouvrirEdition(m)}
            onLongPress={() => confirmerSuppression(m)}
            style={[styles.carte, { backgroundColor: c.backgroundElement, borderColor: c.border }, CardShadow]}>
            <View style={[styles.pastille, { backgroundColor: m.couleur }]}>
              <ThemedText style={{ color: texteSurCouleur(m.couleur), fontWeight: '800' }}>
                {m.nom[0]?.toLocaleUpperCase('fr-FR')}
              </ThemedText>
            </View>
            <ThemedText style={styles.nom}>{m.nom}</ThemedText>
          </Pressable>
        ))}

        <PressableScale onPress={ouvrirAjout} style={[styles.ajout, { borderColor: c.border, backgroundColor: c.backgroundElement }]}>
          <ThemedText style={{ fontWeight: '700', color: c.accent }}>+ Nouvelle matière</ThemedText>
        </PressableScale>
      </ScrollView>

      <ModaleCentree visible={modalVisible} onClose={() => setModalVisible(false)}>
        <ThemedText type="subtitle">{edition ? 'Modifier la matière' : 'Nouvelle matière'}</ThemedText>

        <TextInput
          value={nom}
          onChangeText={setNom}
          placeholder="Maths, Histoire-Géo…"
          placeholderTextColor={c.textSecondary}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={enregistrer}
          style={[styles.champ, { color: c.text, borderColor: c.border }]}
        />

        <View style={styles.palette}>
          {PALETTE.map((col) => (
            <Pressable
              key={col}
              onPress={() => setCouleur(col)}
              style={[styles.swatch, { backgroundColor: col }, couleur === col && { borderWidth: 3, borderColor: c.text }]}
            />
          ))}
        </View>

        <PressableScale
          onPress={enregistrer}
          disabled={!nom.trim()}
          style={[styles.bouton, { backgroundColor: c.accent, opacity: nom.trim() ? 1 : 0.4 }]}>
          <ThemedText style={{ color: c.accentText, fontWeight: '700' }}>
            {edition ? 'Enregistrer' : 'Créer'}
          </ThemedText>
        </PressableScale>
      </ModaleCentree>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  liste: { padding: Spacing.three, gap: Spacing.two },
  vide: { textAlign: 'center', marginTop: Spacing.six, lineHeight: 20 },
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pastille: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  nom: { fontSize: 16, fontWeight: '600' },
  ajout: {
    padding: Spacing.three,
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  champ: { borderWidth: 1, borderRadius: Radius.s, padding: Spacing.three, fontSize: 18 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'center' },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  bouton: { padding: Spacing.three, borderRadius: Radius.s, alignItems: 'center', marginTop: Spacing.two },
});

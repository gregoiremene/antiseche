import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AMENAGEMENTS_COURANTS } from '@/constants/amenagements';
import { Colors, Spacing } from '@/constants/theme';
import { mettreAJourDossier } from '@/db/eleves';

type Props = {
  visible: boolean;
  eleveId: number;
  nomComplet: string;
  amenagements: string[];
  infos: string | null;
  onFermer: () => void;
};

/**
 * Édition du dossier d'un élève : aménagements (tags) et notes libres.
 *
 * Les tags courants sont proposés en un tap, mais le champ libre reste ouvert :
 * aucune liste figée ne couvrira tous les cas réels d'un établissement.
 */
export function EditeurDossier({
  visible,
  eleveId,
  nomComplet,
  amenagements,
  infos,
  onFermer,
}: Props) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  const [selection, setSelection] = useState<string[]>(amenagements);
  const [texte, setTexte] = useState(infos ?? '');
  const [nouveauTag, setNouveauTag] = useState('');

  // resynchronise à l'ouverture : le composant reste monté entre deux fiches
  useEffect(() => {
    if (visible) {
      setSelection(amenagements);
      setTexte(infos ?? '');
      setNouveauTag('');
    }
  }, [visible, amenagements, infos]);

  function basculerTag(tag: string) {
    setSelection((s) => (s.includes(tag) ? s.filter((t) => t !== tag) : [...s, tag]));
  }

  function ajouterTagLibre() {
    const propre = nouveauTag.trim();
    if (!propre || selection.includes(propre)) {
      setNouveauTag('');
      return;
    }
    setSelection((s) => [...s, propre]);
    setNouveauTag('');
  }

  async function enregistrer() {
    await mettreAJourDossier(eleveId, selection, texte);
    onFermer();
  }

  // tags personnalisés déjà posés, absents de la liste courante
  const tagsPersonnalises = selection.filter(
    (t) => !AMENAGEMENTS_COURANTS.includes(t as (typeof AMENAGEMENTS_COURANTS)[number]),
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.fond} onPress={onFermer} />
      <ThemedView
        type="backgroundElement"
        style={[styles.feuille, { paddingBottom: Spacing.four + insets.bottom }]}>
        <ThemedText type="subtitle">Dossier</ThemedText>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {nomComplet}
        </ThemedText>

        <ScrollView style={styles.corps} contentContainerStyle={{ gap: Spacing.three }}>
          <ThemedText style={styles.section}>Aménagements</ThemedText>
          <View style={styles.tags}>
            {AMENAGEMENTS_COURANTS.map((tag) => {
              const actif = selection.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => basculerTag(tag)}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: actif ? c.text : 'transparent',
                      borderColor: actif ? c.text : c.backgroundSelected,
                    },
                  ]}>
                  <ThemedText type="small" style={{ color: actif ? c.background : c.text }}>
                    {tag}
                  </ThemedText>
                </Pressable>
              );
            })}

            {tagsPersonnalises.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => basculerTag(tag)}
                style={[styles.tag, { backgroundColor: c.text, borderColor: c.text }]}>
                <ThemedText type="small" style={{ color: c.background }}>
                  {tag} ✕
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.ligneAjout}>
            <TextInput
              value={nouveauTag}
              onChangeText={setNouveauTag}
              placeholder="Autre aménagement…"
              placeholderTextColor={c.textSecondary}
              returnKeyType="done"
              onSubmitEditing={ajouterTagLibre}
              style={[styles.champ, { flex: 1, color: c.text, borderColor: c.backgroundSelected }]}
            />
            <Pressable
              onPress={ajouterTagLibre}
              style={[styles.boutonAjout, { backgroundColor: c.backgroundSelected }]}>
              <ThemedText>+</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={styles.section}>Notes</ThemedText>
          <TextInput
            value={texte}
            onChangeText={setTexte}
            placeholder="Suivi, contacts famille, points d’attention…"
            placeholderTextColor={c.textSecondary}
            multiline
            style={[
              styles.champ,
              styles.champLong,
              { color: c.text, borderColor: c.backgroundSelected },
            ]}
          />
        </ScrollView>

        <Pressable onPress={enregistrer} style={[styles.bouton, { backgroundColor: c.text }]}>
          <ThemedText style={[styles.boutonTexte, { color: c.background }]}>Enregistrer</ThemedText>
        </Pressable>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  feuille: {
    maxHeight: '85%',
    padding: Spacing.four,
    gap: Spacing.two,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  corps: { marginTop: Spacing.two },
  section: { fontSize: 15, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tag: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
  ligneAjout: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  champ: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
  },
  champLong: { minHeight: 110, textAlignVertical: 'top' },
  boutonAjout: {
    width: 46,
    height: 46,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bouton: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  boutonTexte: { fontSize: 15, fontWeight: '600' },
});

import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { CardShadow, Colors, Radius, Spacing } from '@/constants/theme';

/**
 * Modale centrée à l'écran, réutilisée par toutes les boîtes de dialogue.
 *
 * - Se ferme au tap sur le fond ET au bouton retour Android (`onRequestClose`).
 * - `KeyboardAvoidingView` relève la carte au-dessus du clavier quand un champ
 *   serait masqué ; combiné à `softwareKeyboardLayoutMode: resize` côté natif.
 * - Le contenu défile si la carte dépasse la hauteur dispo (petits écrans).
 *
 * Le fond cliquable est posé DERRIÈRE la carte (absoluteFill), pas autour :
 * un `Pressable` qui enveloppe le `ScrollView` capte le geste et empêche le
 * défilement quand on démarre le drag ailleurs que sur un élément interactif.
 */
export function ModaleCentree({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.plein}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View
          style={[styles.fond, { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four }]}>
          {/* fond cliquable derrière la carte : ferme au tap hors de la carte,
              sans envelopper le ScrollView (sinon il capte le geste de scroll). */}
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={styles.stop}>
            <ThemedView
              type="backgroundElement"
              style={[styles.carte, { borderColor: c.border }, CardShadow]}>
              <ScrollView
                style={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contenu}>
                {children}
              </ScrollView>
            </ThemedView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1 },
  fond: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  stop: { width: '100%', maxWidth: 480, alignSelf: 'center', maxHeight: '100%' },
  carte: {
    borderRadius: Radius.l,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    // sans flexShrink (0 par défaut en RN), la carte garde la hauteur de son
    // contenu et déborde du plafond de `stop` : le bas est rogné et rien ne
    // défile. Elle doit pouvoir se rétrécir jusqu'à maxHeight.
    flexShrink: 1,
  },
  // même raison : le ScrollView doit se rétrécir dans une carte plafonnée pour
  // que son contenu devienne défilable (sinon il garde sa hauteur de contenu).
  scroll: { flexShrink: 1 },
  contenu: { padding: Spacing.four, gap: Spacing.three },
});

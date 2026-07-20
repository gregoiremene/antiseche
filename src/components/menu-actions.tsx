import { useState } from 'react';
import { Modal, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

export type ActionMenu = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

/**
 * Menu « ⋯ » à placer dans l'en-tête de navigation.
 *
 * Sert à ranger les actions rares (créer une classe, importer une liste) qui
 * ne se font qu'en début d'année : elles n'ont pas à occuper un bouton flottant
 * en permanence, contrairement à la saisie quotidienne.
 */
export function MenuActions({ actions }: { actions: ActionMenu[] }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <Pressable onPress={() => setOuvert(true)} hitSlop={12} style={styles.declencheur}>
        <ThemedText style={styles.points}>⋯</ThemedText>
      </Pressable>

      <Modal visible={ouvert} transparent animationType="fade">
        <Pressable style={styles.fond} onPress={() => setOuvert(false)} />
        <View
          style={[
            styles.carte,
            { backgroundColor: c.backgroundElement, top: insets.top + 52 },
          ]}>
          {actions.map((a, i) => (
            <Pressable
              key={a.label}
              onPress={() => {
                setOuvert(false);
                a.onPress();
              }}
              style={({ pressed }) => [
                styles.item,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.backgroundSelected },
                pressed && { backgroundColor: c.backgroundSelected },
              ]}>
              <ThemedText style={a.destructive ? { color: '#E5484D' } : undefined}>
                {a.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  declencheur: { paddingHorizontal: Spacing.two },
  points: { fontSize: 24, lineHeight: 28 },
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
  carte: {
    position: 'absolute',
    right: Spacing.three,
    minWidth: 210,
    borderRadius: Spacing.two,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  item: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.three },
});

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { CardShadow, Colors, Radius, Spacing } from '@/constants/theme';

export type ActionMenu = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

/**
 * Bouton flottant « ⋯ » en bas à droite, dont le menu s'ouvre vers le haut.
 *
 * Rangé en bas car atteignable au pouce, contrairement à l'en-tête. Les actions
 * qu'il contient sont rares (créer une classe, réordonner…), le bouton reste
 * donc discret.
 *
 * `bottomOffset` remonte le bouton au-dessus d'une éventuelle barre d'action
 * (ex. « Saisie rapide » sur l'écran classe).
 */
export function MenuActions({
  actions,
  bottomOffset = 0,
}: {
  actions: ActionMenu[];
  bottomOffset?: number;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const [ouvert, setOuvert] = useState(false);

  const bas = insets.bottom + Spacing.four + bottomOffset;

  return (
    <>
      <PressableScale
        onPress={() => setOuvert(true)}
        style={[styles.fab, CardShadow, { backgroundColor: c.accent, bottom: bas }]}>
        <ThemedText style={[styles.points, { color: c.accentText }]}>⋯</ThemedText>
      </PressableScale>

      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={styles.fond} onPress={() => setOuvert(false)}>
          <View style={[styles.menu, { backgroundColor: c.backgroundElement, borderColor: c.border, bottom: bas + 68 }, CardShadow]}>
            {actions.map((a, i) => (
              <Pressable
                key={a.label}
                onPress={() => {
                  setOuvert(false);
                  a.onPress();
                }}
                style={({ pressed }) => [
                  styles.item,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                  pressed && { backgroundColor: c.backgroundSelected },
                ]}>
                <ThemedText style={a.destructive ? { color: '#E5484D' } : undefined}>
                  {a.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  points: { fontSize: 26, fontWeight: '700', lineHeight: 30 },
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
  menu: {
    position: 'absolute',
    right: Spacing.four,
    minWidth: 220,
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  item: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.three },
});

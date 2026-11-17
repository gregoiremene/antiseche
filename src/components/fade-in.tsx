import { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

/**
 * Fait apparaître son contenu en fondu montant au montage.
 *
 * Complète la transition d'écran native par une entrée douce du contenu.
 * `Animated` natif, sans Reanimated. Le `delay` permet d'échelonner plusieurs
 * blocs pour un effet en cascade.
 */
export function FadeIn({
  children,
  delay = 0,
  offset = 8,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  offset?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  const progres = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progres, {
      toValue: 1,
      duration: 260,
      delay,
      useNativeDriver: true,
    }).start();
  }, [progres, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progres,
          transform: [
            { translateY: progres.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

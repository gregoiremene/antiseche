import { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: ViewStyle | ViewStyle[];
  /** amplitude du rétrécissement à l'appui (0.96 = -4 %) */
  scaleTo?: number;
};

/**
 * Pressable qui se rétracte et s'estompe légèrement à l'appui.
 *
 * Utilise l'API `Animated` intégrée de React Native (pas Reanimated) : aucune
 * dépendance à un plugin Babel, donc rien qui puisse casser à la prochaine
 * montée de SDK. Le retour est traité sur le thread natif (`useNativeDriver`).
 */
export function PressableScale({
  style,
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  return (
    <AnimatedPressable
      onPressIn={(e) => {
        Animated.parallel([
          Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 0 }),
          Animated.timing(opacity, { toValue: 0.85, duration: 90, useNativeDriver: true }),
        ]).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }),
          Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }], opacity }]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}

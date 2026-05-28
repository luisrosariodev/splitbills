import { useRef, useEffect } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';

export function useScreenAnimation(
  count: number,
  options?: { stagger?: number; duration?: number; fromY?: number }
): any[] {
  const { stagger = 90, duration = 420, fromY = 20 } = options ?? {};

  const anims = useRef(
    Array.from({ length: count }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    Animated.stagger(
      stagger,
      anims.map(anim =>
        Animated.timing(anim, {
          toValue: 1,
          duration,
          useNativeDriver: true,
          easing: Easing.out(Easing.exp),
        })
      )
    ).start();
  }, []);

  return anims.map(anim => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [fromY, 0],
        }),
      },
    ],
  })) as Animated.WithAnimatedObject<ViewStyle>[];
}

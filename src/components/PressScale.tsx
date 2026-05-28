import { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

type HapticStyle = 'light' | 'medium' | 'heavy' | 'none';

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: HapticStyle;
  scaleValue?: number;
}

export default function PressScale({
  onPress,
  onPressIn,
  onPressOut,
  style,
  children,
  haptic = 'light',
  scaleValue = 0.96,
  disabled,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: scaleValue,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0,
    }).start();
    (onPressIn as any)?.();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 9,
    }).start();
    (onPressOut as any)?.();
  };

  const handlePress = () => {
    if (disabled) return;
    switch (haptic) {
      case 'light':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
      case 'medium': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
      case 'heavy':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); break;
    }
    (onPress as any)?.();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style as any]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

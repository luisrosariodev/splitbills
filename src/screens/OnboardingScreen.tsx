import { useRef, useState } from 'react';
import { StyleSheet, Text, View, Animated, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T, GRADIENT } from '../lib/theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '➗',
    title: 'Divide sin\ncálculos.',
    body: 'Agrega personas, asigna cada ítem y divvi calcula todo automáticamente.',
  },
  {
    emoji: '📤',
    title: 'Comparte\nen segundos.',
    body: 'Envía el resumen por WhatsApp o exporta el PDF. Todo en un tap.',
  },
  {
    emoji: '✅',
    title: 'Liquida\nsin drama.',
    body: 'Registra quién ya pagó y mantén todo claro. Sin mensajes olvidados.',
  },
];

export const ONBOARDING_KEY = 'divvi_onboarding_done';

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = (next: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      setIndex(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    });
  };

  const handleNext = async () => {
    if (index < SLIDES.length - 1) {
      goTo(index + 1);
    } else {
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
      onDone();
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    onDone();
  };

  const slide = SLIDES[index];

  return (
    <View style={s.container}>
      {/* Skip */}
      {index < SLIDES.length - 1 && (
        <Pressable onPress={handleSkip} style={s.skipBtn}>
          <Text style={s.skipText}>Omitir</Text>
        </Pressable>
      )}

      <Animated.View style={[s.content, { opacity: fadeAnim }]}>
        {/* Emoji */}
        <LinearGradient
          colors={GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.emojiBox}
        >
          <Text style={s.emoji}>{slide.emoji}</Text>
        </LinearGradient>

        {/* Text */}
        <Text style={s.title}>{slide.title}</Text>
        <Text style={s.body}>{slide.body}</Text>
      </Animated.View>

      {/* Dots */}
      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, i === index && s.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <Pressable
        onPress={handleNext}
        style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
      >
        <LinearGradient
          colors={GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.cta}
        >
          <Text style={s.ctaText}>
            {index < SLIDES.length - 1 ? 'Siguiente' : 'Empezar'}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: T.bg,
    paddingHorizontal: 28, paddingTop: 72, paddingBottom: 52,
    justifyContent: 'space-between',
  },
  skipBtn: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8 },
  skipText: { fontSize: 15, color: T.textDim, fontWeight: '500' },

  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emojiBox: {
    width: 96, height: 96, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 44,
    shadowColor: '#6535E8',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3, shadowRadius: 24,
  },
  emoji: { fontSize: 42 },
  title: {
    fontSize: 42, fontWeight: '800', color: T.text,
    letterSpacing: -1.5, lineHeight: 46,
    textAlign: 'center', marginBottom: 20,
  },
  body: {
    fontSize: 17, color: T.textSec, lineHeight: 26,
    textAlign: 'center', maxWidth: 300,
  },

  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 28 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.border },
  dotActive: { width: 22, backgroundColor: T.accent },

  cta: { paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});

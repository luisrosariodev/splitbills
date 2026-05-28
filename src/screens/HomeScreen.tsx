import { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, Animated, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RootStackParamList } from '../types/navigation';
import supabaseClient from '../lib/supabase';
import { getQueueCount } from '../lib/offlineQueue';
import { T } from '../lib/theme';
import PressScale from '../components/PressScale';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const EASE_OUT_EXP = (t: number) => 1 - Math.pow(2, -10 * t);

export default function HomeScreen({ navigation }: Props) {
  const [userInitial, setUserInitial] = useState('?');
  const [queueCount, setQueueCount] = useState(0);

  // Individual animated values for choreography
  const logoAnim = useRef(new Animated.Value(0)).current;
  const eyebrowAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const btn1Anim = useRef(new Animated.Value(0)).current;
  const btn2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabaseClient.auth.getUser().then(({ data: { user } }) => {
      setUserInitial((user?.email ?? '').charAt(0).toUpperCase());
    });

    // Logo: spring pop
    Animated.sequence([
      Animated.delay(60),
      Animated.spring(logoAnim, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 12,
        speed: 14,
      }),
    ]).start();

    // Text cascade
    Animated.stagger(80, [
      Animated.timing(eyebrowAnim, { toValue: 1, duration: 340, useNativeDriver: true }),
      Animated.timing(titleAnim, { toValue: 1, duration: 460, useNativeDriver: true }),
      Animated.timing(subtitleAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();

    // Buttons: stagger after text
    Animated.sequence([
      Animated.delay(340),
      Animated.stagger(70, [
        Animated.spring(btn1Anim, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 18 }),
        Animated.spring(btn2Anim, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 18 }),
      ]),
    ]).start();
  }, []);

  useFocusEffect(useCallback(() => {
    getQueueCount().then(setQueueCount).catch(() => {});
  }, []));

  const fadeSlide = (anim: Animated.Value, fromY = 16) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }) }],
  });

  const logoScale = {
    opacity: logoAnim,
    transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
  };

  const btnScale = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
  });

  return (
    <View style={s.container}>
      {/* Top bar */}
      <View style={s.topBar}>
        <Animated.View style={logoScale}>
          <View style={s.wordmark}>
            <View style={s.logoMark}>
              <Text style={s.logoChar}>$</Text>
            </View>
            <Text style={s.logoText}>splitbills</Text>
          </View>
        </Animated.View>

        <PressScale onPress={() => navigation.navigate('Profile')} haptic="light">
          <View style={s.avatarBtn}>
            <Text style={s.avatarInitial}>{userInitial}</Text>
          </View>
        </PressScale>
      </View>

      {/* Hero */}
      <View style={s.hero}>
        <Animated.Text style={[s.eyebrow, fadeSlide(eyebrowAnim, 10)]}>
          ROSARIODEV
        </Animated.Text>

        <Animated.Text style={[s.title, fadeSlide(titleAnim, 20)]}>
          {'Divide sin\ncomplicarte.'}
        </Animated.Text>

        <Animated.Text style={[s.subtitle, fadeSlide(subtitleAnim, 16)]}>
          Agrega personas, asigna ítems y comparte en segundos.
        </Animated.Text>
      </View>

      {/* Actions */}
      <View style={s.actions}>
        {queueCount > 0 && (
          <View style={s.queueBadge}>
            <View style={s.queueDot} />
            <Text style={s.queueText}>
              {queueCount} split{queueCount > 1 ? 's' : ''} pendiente{queueCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        <Animated.View style={btnScale(btn1Anim)}>
          <PressScale
            onPress={() => navigation.navigate('CreateSplit')}
            style={s.primaryBtn}
            haptic="medium"
            accessibilityLabel="Crear nuevo split"
            accessibilityRole="button"
          >
            <Text style={s.primaryBtnText}>Nuevo Split</Text>
          </PressScale>
        </Animated.View>

        <Animated.View style={btnScale(btn2Anim)}>
          <PressScale
            onPress={() => navigation.navigate('History')}
            style={s.secondaryBtn}
            haptic="light"
            accessibilityLabel="Ver historial"
            accessibilityRole="button"
          >
            <Text style={s.secondaryBtnText}>Ver historial</Text>
          </PressScale>
        </Animated.View>
      </View>

      <Text style={s.footer}>Propina · IVU · Asignaciones individuales</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 44,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 64,
  },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  logoChar: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  logoText: { fontSize: 19, fontWeight: '800', color: T.text, letterSpacing: -0.4 },

  avatarBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: T.accentDim,
    borderWidth: 1.5, borderColor: T.accent + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: T.accent, fontSize: 15, fontWeight: '700' },

  hero: { flex: 1, justifyContent: 'center' },
  eyebrow: {
    fontSize: 10, fontWeight: '700', color: T.accent,
    letterSpacing: 2.8, marginBottom: 18,
  },
  title: {
    fontSize: 50, fontWeight: '800', color: T.text,
    letterSpacing: -2, lineHeight: 54,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16, color: T.textSec,
    lineHeight: 25, maxWidth: 290,
  },

  actions: { gap: 11, paddingBottom: 4 },

  queueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.warningBg,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 4,
  },
  queueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.warning },
  queueText: { color: T.warning, fontSize: 13, fontWeight: '600', flex: 1 },

  primaryBtn: {
    backgroundColor: T.accent,
    paddingVertical: 18, borderRadius: 16,
    alignItems: 'center',
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  secondaryBtn: {
    paddingVertical: 16, borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: T.borderMid,
    backgroundColor: T.surface,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.1 },
  secondaryBtnText: { color: T.text, fontSize: 17, fontWeight: '600' },

  footer: {
    textAlign: 'center', fontSize: 11,
    color: T.textDim, letterSpacing: 0.6, marginTop: 20,
  },
});

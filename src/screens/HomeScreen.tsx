import { useEffect, useRef, useCallback, useState } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../types/navigation';
import supabaseClient from '../lib/supabase';
import { getQueueCount } from '../lib/offlineQueue';
import { T, GRADIENT, FONTS } from '../lib/theme';
import PressScale from '../components/PressScale';
import DivviLogo from '../components/DivviLogo';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [userInitial, setUserInitial] = useState('?');
  const [queueCount, setQueueCount] = useState(0);

  const logoAnim  = useRef(new Animated.Value(0)).current;
  const heroAnim  = useRef(new Animated.Value(0)).current;
  const btn1Anim  = useRef(new Animated.Value(0)).current;
  const btn2Anim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabaseClient.auth.getUser()
      .then(({ data: { user } }) => {
        setUserInitial((user?.email ?? '').charAt(0).toUpperCase());
      })
      .catch(() => {});

    Animated.sequence([
      Animated.delay(50),
      Animated.spring(logoAnim, { toValue: 1, useNativeDriver: true, bounciness: 10, speed: 14 }),
    ]).start();

    Animated.sequence([
      Animated.delay(160),
      Animated.timing(heroAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(380),
      Animated.stagger(70, [
        Animated.spring(btn1Anim, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 18 }),
        Animated.spring(btn2Anim, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 18 }),
      ]),
    ]).start();
  }, []);

  useFocusEffect(useCallback(() => {
    getQueueCount().then(setQueueCount).catch(() => {});
  }, []));

  const fadeSlide = (anim: Animated.Value, fromY = 18) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }) }],
  });

  const logoStyle = {
    opacity: logoAnim,
    transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
  };

  const btnStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
  });

  return (
    <View style={s.container}>
      {/* Top bar */}
      <View style={s.topBar}>
        <Animated.View style={logoStyle}>
          <DivviLogo size="md" />
        </Animated.View>

        <PressScale onPress={() => navigation.navigate('Profile')} haptic="light">
          <LinearGradient
            colors={GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.avatarBtn}
          >
            <Text style={s.avatarInitial}>{userInitial}</Text>
          </LinearGradient>
        </PressScale>
      </View>

      {/* Hero */}
      <Animated.View style={[s.hero, fadeSlide(heroAnim, 24)]}>
        <Text style={s.eyebrow}>ROSARIODEV</Text>
        <Text style={s.title}>{'Divide sin\ncomplicarte.'}</Text>
        <Text style={s.subtitle}>
          Agrega personas, asigna ítems y comparte en segundos.
        </Text>
      </Animated.View>

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

        <Animated.View style={btnStyle(btn1Anim)}>
          <PressScale
            onPress={() => navigation.navigate('CreateSplit')}
            haptic="medium"
            accessibilityLabel="Crear nuevo divvi"
            accessibilityRole="button"
          >
            <LinearGradient
              colors={GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryBtn}
            >
              <Text style={s.primaryBtnText}>Nuevo divvi</Text>
            </LinearGradient>
          </PressScale>
        </Animated.View>

        <Animated.View style={btnStyle(btn2Anim)}>
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
    flex: 1, backgroundColor: T.bg,
    paddingHorizontal: 24, paddingTop: 56, paddingBottom: 44,
  },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 64,
  },

  avatarBtn: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 15, fontWeight: '700' },

  hero: { flex: 1, justifyContent: 'center' },
  eyebrow: {
    fontSize: 10, fontFamily: FONTS.bold, color: T.accent,
    letterSpacing: 2.8, marginBottom: 18,
  },
  title: {
    fontSize: 50, fontFamily: FONTS.bold, color: T.text,
    letterSpacing: -1.5, lineHeight: 54, marginBottom: 20,
  },
  subtitle: { fontSize: 16, fontFamily: FONTS.regular, color: T.textSec, lineHeight: 25, maxWidth: 290 },

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
    paddingVertical: 18, borderRadius: 16, alignItems: 'center',
  },
  secondaryBtn: {
    paddingVertical: 16, borderRadius: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: T.borderMid, backgroundColor: T.surface,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontFamily: FONTS.bold, letterSpacing: 0.1 },
  secondaryBtnText: { color: T.text, fontSize: 17, fontFamily: FONTS.bold },

  footer: {
    textAlign: 'center', fontSize: 11,
    color: T.textDim, letterSpacing: 0.6, marginTop: 20,
  },
});

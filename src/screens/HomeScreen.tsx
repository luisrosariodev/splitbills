import { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import supabaseClient from '../lib/supabase';
import { getQueueCount } from '../lib/offlineQueue';
import { T } from '../lib/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [userInitial, setUserInitial] = useState('?');
  const [queueCount, setQueueCount] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    supabaseClient.auth.getUser().then(({ data: { user } }) => {
      setUserInitial((user?.email ?? '').charAt(0).toUpperCase());
    });
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: 80, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 420, delay: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  useFocusEffect(useCallback(() => {
    getQueueCount().then(setQueueCount).catch(() => {});
  }, []));

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.wordmark}>
          <View style={styles.wordmarkIcon}>
            <Text style={styles.wordmarkChar}>$</Text>
          </View>
          <Text style={styles.wordmarkText}>splitbills</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('Profile')}
          style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.6 }]}
          accessibilityLabel="Ir al perfil"
          accessibilityRole="button"
          hitSlop={12}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{userInitial}</Text>
          </View>
        </Pressable>
      </View>

      {/* Hero content */}
      <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.eyebrow}>ROSARIODEV</Text>
        <Text style={styles.title}>{'Divide sin\ncomplicarte.'}</Text>
        <Text style={styles.subtitle}>
          Agrega personas, asigna items, comparte en segundos.
        </Text>
      </Animated.View>

      {/* Actions */}
      <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
        {queueCount > 0 && (
          <View style={styles.queueBadge}>
            <View style={styles.queueDot} />
            <Text style={styles.queueText}>
              {queueCount} split{queueCount > 1 ? 's' : ''} pendiente{queueCount > 1 ? 's' : ''} de sincronizar
            </Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('CreateSplit')}
          accessibilityLabel="Crear nuevo split"
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>Nuevo Split</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('History')}
          accessibilityLabel="Ver historial de splits"
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>Ver historial</Text>
        </Pressable>
      </Animated.View>

      <Text style={styles.footer}>Propina · IVU · Asignaciones individuales</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 56,
  },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmarkIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  wordmarkChar: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  wordmarkText: { fontSize: 18, fontWeight: '800', color: T.text, letterSpacing: -0.4 },

  avatarBtn: {},
  avatarCircle: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: T.surfaceHigh,
    borderWidth: 1, borderColor: T.borderMid,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: T.text, fontSize: 14, fontWeight: '700' },

  hero: { flex: 1, justifyContent: 'center' },
  eyebrow: {
    fontSize: 10, fontWeight: '700', color: T.accent,
    letterSpacing: 2.5, marginBottom: 20,
  },
  title: {
    fontSize: 52, fontWeight: '800', color: T.text,
    letterSpacing: -2, lineHeight: 56,
    marginBottom: 18,
  },
  subtitle: {
    fontSize: 16, color: T.textSec,
    lineHeight: 24, maxWidth: 280,
  },

  actions: { gap: 10, paddingBottom: 8 },
  queueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.warningBg,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 4,
  },
  queueDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: T.warning,
  },
  queueText: { color: T.warning, fontSize: 13, fontWeight: '600', flex: 1 },

  primaryBtn: {
    backgroundColor: T.accent,
    paddingVertical: 18, borderRadius: 16,
    alignItems: 'center',
  },
  secondaryBtn: {
    paddingVertical: 16, borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: T.borderMid,
  },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  secondaryBtnText: { color: T.textSec, fontSize: 17, fontWeight: '600' },

  footer: {
    textAlign: 'center', fontSize: 11,
    color: T.textDim, letterSpacing: 0.5,
    marginTop: 20,
  },
});

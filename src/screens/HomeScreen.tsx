import { useEffect } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import supabaseClient from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const C = {
  bg: '#F2F2F7',
  accent: '#007AFF',
  text: '#1C1C1E',
  textSub: '#6C6C70',
  surface: '#FFFFFF',
  border: '#E5E5EA',
};

export default function HomeScreen({ navigation }: Props) {
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => supabaseClient.auth.signOut().catch(() => {})}
          style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
          hitSlop={12}
        >
          <Text style={{ color: C.accent, fontSize: 16, fontWeight: '500' }}>Salir</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Wordmark */}
      <View style={styles.wordmark}>
        <View style={styles.wordmarkIcon}>
          <Text style={styles.wordmarkIconText}>$</Text>
        </View>
        <Text style={styles.wordmarkText}>splitbills</Text>
      </View>

      <Text style={styles.title}>{'Divide sin\ncomplicarte.'}</Text>
      <Text style={styles.subtitle}>Agrega, asigna y comparte en segundos.</Text>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('CreateSplit')}
        >
          <Text style={styles.primaryBtnText}>Nuevo Split</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.secondaryBtnText}>Ver historial</Text>
        </Pressable>
      </View>

      {/* Bottom detail */}
      <Text style={styles.footerNote}>Propina, IVU y asignaciones individuales incluidas.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 40,
  },
  wordmarkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkIconText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  wordmarkText: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: C.text,
    textAlign: 'center',
    letterSpacing: -1.2,
    lineHeight: 48,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 48,
    maxWidth: 260,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: C.accent,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryBtn: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.accent,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.88,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  secondaryBtnText: {
    color: C.accent,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  footerNote: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: C.textSub,
    textAlign: 'center',
  },
});

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import supabaseClient from '../lib/supabase';

const C = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  border: '#E5E5EA',
  accent: '#007AFF',
  text: '#1C1C1E',
  textSub: '#6C6C70',
  textMuted: '#AEAEB2',
  danger: '#FF3B30',
  surfaceAlt: '#F9F9FB',
};

const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Email o contraseña incorrectos.',
  'Email not confirmed': 'Confirma tu email antes de iniciar sesión.',
  'User already registered': 'Este email ya está registrado.',
};

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    setInfo('');

    try {
      if (mode === 'login') {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Revisa tu email para confirmar tu cuenta.');
      }
    } catch (e: any) {
      const msg = e?.message ?? '';
      setError(ERROR_MAP[msg] ?? msg ?? 'Ocurrió un error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.eyebrow}>SPLIT BILLS</Text>
        <Text style={styles.title}>
          {mode === 'login' ? 'Bienvenido.' : 'Crea tu cuenta.'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor={C.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.label, { marginTop: 14 }]}>CONTRASENA</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={C.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {error !== '' && <Text style={styles.error}>{error}</Text>}
        {info !== '' && <Text style={styles.info}>{info}</Text>}

        <Pressable
          style={({ pressed }) => [styles.btn, loading && styles.btnDisabled, pressed && styles.pressed]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>{mode === 'login' ? 'Iniciar sesion' : 'Registrarse'}</Text>
          }
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.switchBtn, pressed && styles.pressed]}
          onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo(''); }}
        >
          <Text style={styles.switchText}>
            {mode === 'login' ? '¿Sin cuenta? Registrate' : '¿Ya tienes cuenta? Inicia sesion'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.bg },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: C.accent,
    letterSpacing: 1.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.8,
    marginBottom: 28,
    textAlign: 'center',
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSub,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: C.text,
    backgroundColor: C.surfaceAlt,
  },
  error: {
    color: C.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  info: {
    color: '#1A7A40',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  btn: {
    backgroundColor: C.accent,
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchBtn: { alignItems: 'center', padding: 10 },
  switchText: { color: C.accent, fontSize: 15, fontWeight: '500' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
});

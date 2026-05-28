import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import supabaseClient from '../lib/supabase';
import { validateEmail, validatePassword, sanitize } from '../lib/validation';
import { T } from '../lib/theme';

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
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }
    const pwErr = validatePassword(password);
    if (pwErr) { setError(pwErr); return; }
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const cleanEmail = sanitize(email).toLowerCase();
      if (mode === 'login') {
        const { error } = await supabaseClient.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.auth.signUp({ email: cleanEmail, password });
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoBox}>
            <Text style={styles.logoChar}>$</Text>
          </View>
          <Text style={styles.brandName}>splitbills</Text>
          <Text style={styles.brandBy}>by rosariodev</Text>
        </View>

        {/* Heading */}
        <Text style={styles.heading}>
          {mode === 'login' ? 'Bienvenido.' : 'Crea tu cuenta.'}
        </Text>
        <Text style={styles.subheading}>
          {mode === 'login'
            ? 'Inicia sesión para ver tus splits.'
            : 'Únete y empieza a dividir en segundos.'}
        </Text>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="tu@email.com"
              placeholderTextColor={T.textDim}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Correo electrónico"
            />
          </View>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>CONTRASEÑA</Text>
            <TextInput
              style={styles.input}
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor={T.textDim}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              accessibilityLabel="Contraseña"
            />
          </View>
        </View>

        {error !== '' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {info !== '' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{info}</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.btn, loading && styles.btnDisabled, pressed && styles.pressed]}
          onPress={handleSubmit}
          disabled={loading}
          accessibilityLabel={mode === 'login' ? 'Iniciar sesión' : 'Registrarse'}
          accessibilityRole="button"
        >
          {loading
            ? <ActivityIndicator color={T.bg} />
            : <Text style={styles.btnText}>{mode === 'login' ? 'Iniciar sesión' : 'Registrarse'}</Text>
          }
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.switchBtn, pressed && styles.pressed]}
          onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo(''); }}
          accessibilityLabel={mode === 'login' ? 'Crear una cuenta' : 'Ya tengo cuenta'}
          accessibilityRole="button"
        >
          <Text style={styles.switchText}>
            {mode === 'login' ? '¿Sin cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: T.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 60,
  },

  brand: { alignItems: 'center', marginBottom: 48 },
  logoBox: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  logoChar: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  brandName: { fontSize: 20, fontWeight: '800', color: T.text, letterSpacing: -0.5, marginBottom: 4 },
  brandBy: { fontSize: 11, fontWeight: '500', color: T.textDim, letterSpacing: 0.5 },

  heading: {
    fontSize: 38, fontWeight: '800', color: T.text,
    letterSpacing: -1.2, marginBottom: 8,
  },
  subheading: {
    fontSize: 15, color: T.textSec, lineHeight: 22,
    marginBottom: 36,
  },

  form: { gap: 16, marginBottom: 20 },
  fieldWrap: { gap: 8 },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: T.textDim,
    letterSpacing: 1.4,
  },
  input: {
    backgroundColor: T.surfaceHigh,
    borderWidth: 1, borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: T.text,
  },

  errorBox: {
    backgroundColor: T.dangerBg,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: { color: T.danger, fontSize: 13, fontWeight: '500' },
  infoBox: {
    backgroundColor: T.successBg,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16,
  },
  infoText: { color: T.success, fontSize: 13, fontWeight: '500' },

  btn: {
    backgroundColor: T.accent,
    paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginBottom: 14,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  switchBtn: { alignItems: 'center', paddingVertical: 12 },
  switchText: { color: T.accentText, fontSize: 15, fontWeight: '600' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
});

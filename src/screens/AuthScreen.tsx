import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Animated,
} from 'react-native';
import supabaseClient from '../lib/supabase';
import { validateEmail, validatePassword, sanitize } from '../lib/validation';
import { T } from '../lib/theme';
import { useScreenAnimation } from '../hooks/useScreenAnimation';
import PressScale from '../components/PressScale';

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

  const anims = useScreenAnimation(4, { stagger: 100, duration: 440, fromY: 22 });

  const handleSubmit = async () => {
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }
    const pwErr = validatePassword(password);
    if (pwErr) { setError(pwErr); return; }
    setLoading(true); setError(''); setInfo('');
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
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Brand mark */}
        <Animated.View style={[s.brandWrap, anims[0]]}>
          <View style={s.logoBox}>
            <Text style={s.logoChar}>$</Text>
          </View>
          <Text style={s.brandName}>splitbills</Text>
          <Text style={s.brandBy}>by rosariodev</Text>
        </Animated.View>

        {/* Heading */}
        <Animated.View style={anims[1]}>
          <Text style={s.heading}>
            {mode === 'login' ? 'Bienvenido.' : 'Crea tu cuenta.'}
          </Text>
          <Text style={s.subheading}>
            {mode === 'login'
              ? 'Inicia sesión para ver tus splits.'
              : 'Únete y empieza a dividir en segundos.'}
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View style={anims[2]}>
          <View style={s.form}>
            <View style={s.field}>
              <Text style={s.fieldLabel}>EMAIL</Text>
              <TextInput
                style={s.input}
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
            <View style={s.field}>
              <Text style={s.fieldLabel}>CONTRASEÑA</Text>
              <TextInput
                style={s.input}
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
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}
          {info !== '' && (
            <View style={s.infoBox}>
              <Text style={s.infoText}>{info}</Text>
            </View>
          )}
        </Animated.View>

        {/* Actions */}
        <Animated.View style={anims[3]}>
          <PressScale
            onPress={handleSubmit}
            style={[s.btn, loading ? s.btnOff : undefined]}
            haptic="medium"
            disabled={loading}
            accessibilityLabel={mode === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            accessibilityRole="button"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{mode === 'login' ? 'Iniciar sesión' : 'Registrarse'}</Text>
            }
          </PressScale>

          <PressScale
            onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo(''); }}
            style={s.switchBtn}
            haptic="light"
            accessibilityRole="button"
          >
            <Text style={s.switchText}>
              {mode === 'login' ? '¿Sin cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
            </Text>
          </PressScale>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: T.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 64 },

  brandWrap: { alignItems: 'center', marginBottom: 52 },
  logoBox: {
    width: 60, height: 60, borderRadius: 19,
    backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
  logoChar: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  brandName: { fontSize: 21, fontWeight: '800', color: T.text, letterSpacing: -0.5, marginBottom: 4 },
  brandBy: { fontSize: 11, fontWeight: '500', color: T.textDim, letterSpacing: 0.6 },

  heading: { fontSize: 36, fontWeight: '800', color: T.text, letterSpacing: -1.1, marginBottom: 8 },
  subheading: { fontSize: 15, color: T.textSec, lineHeight: 22, marginBottom: 36 },

  form: { gap: 16, marginBottom: 20 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: T.accent, letterSpacing: 1.6 },
  input: {
    backgroundColor: T.surface,
    borderWidth: 1.5, borderColor: T.border,
    borderRadius: 13,
    paddingHorizontal: 16, paddingVertical: 15,
    fontSize: 16, color: T.text,
  },

  errorBox: {
    backgroundColor: T.dangerBg, borderRadius: 11,
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16,
  },
  errorText: { color: T.danger, fontSize: 13, fontWeight: '500' },
  infoBox: {
    backgroundColor: T.successBg, borderRadius: 11,
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16,
  },
  infoText: { color: T.success, fontSize: 13, fontWeight: '500' },

  btn: {
    backgroundColor: T.accent,
    paddingVertical: 17, borderRadius: 15,
    alignItems: 'center', marginBottom: 14,
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  btnOff: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  switchBtn: { alignItems: 'center', paddingVertical: 14 },
  switchText: { color: T.accentText, fontSize: 15, fontWeight: '600' },
});

import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Animated, Linking,
} from 'react-native';
import supabaseClient from '../lib/supabase';
import { validateEmail, validatePassword, sanitize } from '../lib/validation';
import { recordTermsAccepted } from '../lib/splitService';
import { useColors, GRADIENT } from '../lib/theme';
import { useScreenAnimation } from '../hooks/useScreenAnimation';
import PressScale from '../components/PressScale';
import DivviLogo from '../components/DivviLogo';
import { LinearGradient } from 'expo-linear-gradient';

const PRIVACY_URL = 'https://rosariodev.com/divvi/privacy';

const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Email o contraseña incorrectos.',
  'Email not confirmed': 'Confirma tu email antes de iniciar sesión.',
  'User already registered': 'Este email ya está registrado.',
};

export default function AuthScreen() {
  const T = useColors();
  const s = makeStyles(T);
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
        const { data, error } = await supabaseClient.auth.signUp({ email: cleanEmail, password });
        if (error) throw error;
        // Record terms acceptance immediately after account creation
        if (data.user) {
          recordTermsAccepted().catch(() => {});
        }
        setInfo('Revisa tu email para confirmar tu cuenta.');
      }
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (
        msg.includes('Network request failed') ||
        msg.includes('network_unavailable') ||
        msg.includes('Failed to fetch') ||
        msg.includes('offline')
      ) {
        setError('Sin conexión. Verifica tu internet e intenta de nuevo.');
      } else {
        setError(ERROR_MAP[msg] ?? msg ?? 'Ocurrió un error.');
      }
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Brand mark */}
        <Animated.View style={[s.brandWrap, anims[0]]}>
          <LinearGradient
            colors={GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.logoBox}
          >
            <DivviLogo size="sm" showWordmark={false} />
          </LinearGradient>
          <DivviLogo size="lg" showWordmark />
          <Text style={s.brandBy}>by rosariodev</Text>
        </Animated.View>

        {/* Heading */}
        <Animated.View style={anims[1]}>
          <Text style={s.heading}>
            {mode === 'login' ? 'Bienvenido.' : 'Crea tu cuenta.'}
          </Text>
          <Text style={s.subheading}>
            {mode === 'login'
              ? 'Inicia sesión para ver tus divvis.'
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
            haptic="medium"
            disabled={loading}
            accessibilityLabel={mode === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            accessibilityRole="button"
            style={loading ? s.btnOff : undefined}
          >
            <LinearGradient
              colors={GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.btn}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>{mode === 'login' ? 'Iniciar sesión' : 'Registrarse'}</Text>
              }
            </LinearGradient>
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

          {mode === 'register' && (
            <Text style={s.legalText}>
              Al registrarte, aceptas nuestra{' '}
              <Text style={s.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
                Política de Privacidad
              </Text>
              {'. '}
              Tu foto de recibo es procesada por IA (Claude de Anthropic) y no se almacena permanentemente.
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (T: ReturnType<typeof useColors>) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: T.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 64 },

  brandWrap: { alignItems: 'center', marginBottom: 52, gap: 14 },
  logoBox: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6535E8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  brandBy: { fontSize: 11, fontWeight: '500', color: T.textDim, letterSpacing: 0.6, marginTop: -8 },

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
    paddingVertical: 17, borderRadius: 15,
    alignItems: 'center', marginBottom: 14,
  },
  btnOff: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  switchBtn: { alignItems: 'center', paddingVertical: 14 },
  switchText: { color: T.accentText, fontSize: 15, fontWeight: '600' },

  legalText: {
    fontSize: 12, color: T.textDim, textAlign: 'center',
    lineHeight: 18, marginTop: 8, paddingHorizontal: 8,
  },
  legalLink: { color: T.accent, fontWeight: '600' },
});

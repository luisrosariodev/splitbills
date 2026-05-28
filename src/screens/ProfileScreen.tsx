import { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  ScrollView, Alert, ActivityIndicator, Linking, Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../types/navigation';
import {
  getProfile, updateProfile, updatePassword,
  deleteAllUserData, getUserStats,
} from '../lib/splitService';
import supabaseClient from '../lib/supabase';
import { validateDisplayName, validatePassword } from '../lib/validation';
import { T, GRADIENT } from '../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useScreenAnimation } from '../hooks/useScreenAnimation';
import PressScale from '../components/PressScale';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [pwInput, setPwInput] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [stats, setStats] = useState<{ splitCount: number; totalEstimated: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [nameMsg, setNameMsg] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  const anims = useScreenAnimation(5, { stagger: 80, duration: 400, fromY: 18 });

  useEffect(() => {
    Promise.all([getProfile(), getUserStats()])
      .then(([profile, s]) => {
        setEmail(profile.email);
        setDisplayName(profile.displayName);
        setNameInput(profile.displayName);
        setStats(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveName = async () => {
    const err = validateDisplayName(nameInput);
    if (err) { Alert.alert('Nombre inválido', err); return; }
    setSavingName(true); setNameMsg('');
    try {
      await updateProfile(nameInput.trim());
      setDisplayName(nameInput.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNameMsg('Nombre actualizado.');
      setTimeout(() => setNameMsg(''), 3000);
    } catch { Alert.alert('Error', 'No se pudo actualizar el nombre.'); }
    finally { setSavingName(false); }
  };

  const handleChangePassword = async () => {
    const err = validatePassword(pwInput);
    if (err) { setPwError(err); return; }
    if (pwInput !== pwConfirm) { setPwError('Las contraseñas no coinciden.'); return; }
    setPwError(''); setSavingPw(true); setPwMsg('');
    try {
      await updatePassword(pwInput);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPwInput(''); setPwConfirm('');
      setPwMsg('Contraseña actualizada.');
      setTimeout(() => setPwMsg(''), 3000);
    } catch (e: any) { Alert.alert('Error', e?.message || 'No se pudo cambiar la contraseña.'); }
    finally { setSavingPw(false); }
  };

  const handleLogout = () => Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Salir', style: 'destructive', onPress: () => supabaseClient.auth.signOut().catch(() => {}) },
  ]);

  const handleDeleteAccount = () => Alert.alert(
    'Eliminar cuenta',
    'Se borrarán todos tus splits, grupos y datos. Esta acción no se puede deshacer.',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar todo', style: 'destructive', onPress: async () => {
        try { await deleteAllUserData(); }
        catch { Alert.alert('Error', 'No se pudo eliminar la cuenta.'); }
      }},
    ],
  );

  const initial = (displayName || email).charAt(0).toUpperCase();

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={T.accent} size="large" /></View>
  );

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Identity */}
      <Animated.View style={anims[0]}>
        <View style={s.identityBlock}>
          <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </LinearGradient>
          {displayName !== '' && <Text style={s.displayName}>{displayName}</Text>}
          <Text style={s.emailText}>{email}</Text>
        </View>
      </Animated.View>

      {/* Stats */}
      {stats && (
        <Animated.View style={anims[1]}>
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statNum}>{stats.splitCount}</Text>
              <Text style={s.statLabel}>SPLITS</Text>
            </View>
            <View style={[s.statCard, { flex: 1.5 }]}>
              <Text style={s.statNum}>${stats.totalEstimated.toFixed(0)}</Text>
              <Text style={s.statLabel}>TOTAL DIVIDIDO</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Edit profile */}
      <Animated.View style={anims[2]}>
        <View style={s.section}>
          <Text style={s.sectionLabel}>NOMBRE VISIBLE</Text>
          <TextInput
            style={s.input}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="Tu nombre"
            placeholderTextColor={T.textDim}
            autoCorrect={false}
          />
          {nameMsg !== '' && <Text style={s.successMsg}>{nameMsg}</Text>}
          <PressScale
            onPress={handleSaveName}
            style={[s.btn, (savingName || nameInput.trim() === displayName) && s.btnOff]}
            haptic="medium"
            disabled={savingName || nameInput.trim() === displayName}
          >
            <Text style={s.btnText}>{savingName ? 'Guardando...' : 'Guardar nombre'}</Text>
          </PressScale>
        </View>

        <View style={[s.section, { marginTop: 12 }]}>
          <Text style={s.sectionLabel}>CAMBIAR CONTRASEÑA</Text>
          <TextInput
            style={s.input}
            value={pwInput}
            onChangeText={setPwInput}
            placeholder="Nueva contraseña"
            placeholderTextColor={T.textDim}
            secureTextEntry
          />
          <TextInput
            style={[s.input, { marginTop: 8 }]}
            value={pwConfirm}
            onChangeText={setPwConfirm}
            placeholder="Confirmar contraseña"
            placeholderTextColor={T.textDim}
            secureTextEntry
          />
          {pwError !== '' && <Text style={s.errorMsg}>{pwError}</Text>}
          {pwMsg !== '' && <Text style={s.successMsg}>{pwMsg}</Text>}
          <PressScale
            onPress={handleChangePassword}
            style={[s.btn, (!pwInput || savingPw) && s.btnOff]}
            haptic="medium"
            disabled={savingPw || !pwInput}
          >
            <Text style={s.btnText}>{savingPw ? 'Actualizando...' : 'Cambiar contraseña'}</Text>
          </PressScale>
        </View>
      </Animated.View>

      {/* Navigation rows */}
      <Animated.View style={anims[3]}>
        <View style={s.rowList}>
          <PressScale onPress={() => navigation.navigate('Settings')} style={s.row} haptic="light">
            <Text style={s.rowLabel}>Configuración</Text>
            <Text style={s.chevron}>›</Text>
          </PressScale>
          <View style={s.divider} />
          <PressScale onPress={handleLogout} style={s.row} haptic="light">
            <Text style={[s.rowLabel, { color: T.danger }]}>Cerrar sesión</Text>
          </PressScale>
          <View style={s.divider} />
          <PressScale onPress={handleDeleteAccount} style={s.row} haptic="light">
            <Text style={[s.rowLabel, { color: T.textDim, fontSize: 13 }]}>Eliminar cuenta y datos</Text>
          </PressScale>
        </View>
      </Animated.View>

      {/* rosariodev branded section */}
      <Animated.View style={anims[4]}>
        <View style={s.rosarioCard}>
          <View style={s.rosarioHeader}>
            <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.rosarioMark}>
              <Text style={s.rosarioMarkChar}>R</Text>
            </LinearGradient>
            <View style={s.rosarioMeta}>
              <Text style={s.rosarioName}>rosariodev</Text>
              <Text style={s.rosarioTagline}>Software & Design Studio</Text>
            </View>
          </View>

          <View style={s.rosarioDivider} />

          <PressScale
            onPress={() => Linking.openURL('https://rosariodev.com')}
            style={s.rosarioLink}
            haptic="light"
          >
            <View style={s.rosarioLinkIcon}>
              <Text style={s.rosarioLinkIconText}>🌐</Text>
            </View>
            <Text style={s.rosarioLinkText}>rosariodev.com</Text>
            <Text style={s.rosarioLinkArrow}>›</Text>
          </PressScale>

          <View style={s.rosarioDivider} />

          <PressScale
            onPress={() => Linking.openURL('mailto:contact@rosariodev.com')}
            style={s.rosarioLink}
            haptic="light"
          >
            <View style={s.rosarioLinkIcon}>
              <Text style={s.rosarioLinkIconText}>✉</Text>
            </View>
            <Text style={s.rosarioLinkText}>contact@rosariodev.com</Text>
            <Text style={s.rosarioLinkArrow}>›</Text>
          </PressScale>

          <Text style={s.rosarioFooter}>rosariodev · divvi</Text>
        </View>
      </Animated.View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: T.bg },
  content: { padding: 20, paddingBottom: 64, gap: 12 },
  center: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },

  identityBlock: { alignItems: 'center', paddingVertical: 28 },
  avatar: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#6535E8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '900' },
  displayName: { fontSize: 22, fontWeight: '800', color: T.text, letterSpacing: -0.5, marginBottom: 4 },
  emailText: { fontSize: 14, color: T.textSec },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: T.surface, borderRadius: 16,
    padding: 18, borderWidth: 1, borderColor: T.border,
  },
  statNum: { fontSize: 30, fontWeight: '800', color: T.text, letterSpacing: -1, marginBottom: 2 },
  statLabel: { fontSize: 9, fontWeight: '700', color: T.textDim, letterSpacing: 1.6 },

  section: { backgroundColor: T.surface, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: T.border },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: T.accent, letterSpacing: 1.6 },
  input: {
    backgroundColor: T.surfaceAlt, borderWidth: 1, borderColor: T.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 16, color: T.text,
  },
  btn: {
    backgroundColor: T.accent, padding: 13, borderRadius: 12,
    alignItems: 'center', marginTop: 2,
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  btnOff: { opacity: 0.35, shadowOpacity: 0 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  errorMsg: { color: T.danger, fontSize: 12 },
  successMsg: { color: T.success, fontSize: 12, fontWeight: '600' },

  rowList: { backgroundColor: T.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  row: { paddingHorizontal: 16, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 16, color: T.text, fontWeight: '500' },
  chevron: { fontSize: 20, color: T.textDim },
  divider: { height: 1, backgroundColor: T.border, marginLeft: 16 },

  // rosariodev branded card
  rosarioCard: {
    backgroundColor: T.surface,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1.5, borderColor: T.accent + '25',
  },
  rosarioHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, paddingBottom: 16,
    backgroundColor: T.accentDim,
  },
  rosarioMark: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#6535E8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  rosarioMarkChar: { color: '#fff', fontSize: 20, fontWeight: '900' },
  rosarioMeta: { flex: 1 },
  rosarioName: { fontSize: 17, fontWeight: '800', color: T.text, letterSpacing: -0.3 },
  rosarioTagline: { fontSize: 12, color: T.textSec, marginTop: 1 },

  rosarioDivider: { height: 1, backgroundColor: T.border },
  rosarioLink: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 15,
  },
  rosarioLinkIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: T.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  rosarioLinkIconText: { fontSize: 14 },
  rosarioLinkText: { flex: 1, fontSize: 14, color: T.accent, fontWeight: '600' },
  rosarioLinkArrow: { fontSize: 18, color: T.textDim },

  rosarioFooter: {
    textAlign: 'center', fontSize: 11, color: T.textDim,
    letterSpacing: 0.4, paddingVertical: 14,
  },
});

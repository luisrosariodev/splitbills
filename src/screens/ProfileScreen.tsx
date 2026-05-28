import { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable,
  ScrollView, Alert, ActivityIndicator,
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
import { T } from '../lib/theme';

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
    setPwError('');
    setSavingPw(true); setPwMsg('');
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

  if (loading) return <View style={s.center}><ActivityIndicator color={T.accent} /></View>;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Identity */}
      <View style={s.identityBlock}>
        <View style={s.avatar}><Text style={s.avatarText}>{initial}</Text></View>
        {displayName !== '' && <Text style={s.displayName}>{displayName}</Text>}
        <Text style={s.email}>{email}</Text>
      </View>

      {/* Stats */}
      {stats && (
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{stats.splitCount}</Text>
            <Text style={s.statLabel}>SPLITS</Text>
          </View>
          <View style={[s.statCard, { flex: 1.4 }]}>
            <Text style={s.statValue}>${stats.totalEstimated.toFixed(0)}</Text>
            <Text style={s.statLabel}>TOTAL DIVIDIDO</Text>
          </View>
        </View>
      )}

      {/* Display name */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>NOMBRE VISIBLE</Text>
        <TextInput
          style={s.input}
          value={nameInput}
          onChangeText={setNameInput}
          placeholder="Tu nombre"
          placeholderTextColor={T.textDim}
          autoCorrect={false}
          accessibilityLabel="Nombre visible"
        />
        {nameMsg !== '' && <Text style={s.successMsg}>{nameMsg}</Text>}
        <Pressable
          style={({ pressed }) => [s.btn, (savingName || nameInput.trim() === displayName) && s.btnOff, pressed && s.pressed]}
          onPress={handleSaveName}
          disabled={savingName || nameInput.trim() === displayName}
          accessibilityRole="button"
        >
          <Text style={s.btnText}>{savingName ? 'Guardando...' : 'Guardar nombre'}</Text>
        </Pressable>
      </View>

      {/* Password */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>CAMBIAR CONTRASEÑA</Text>
        <TextInput style={s.input} value={pwInput} onChangeText={setPwInput} placeholder="Nueva contraseña" placeholderTextColor={T.textDim} secureTextEntry accessibilityLabel="Nueva contraseña" />
        <TextInput style={[s.input, { marginTop: 8 }]} value={pwConfirm} onChangeText={setPwConfirm} placeholder="Confirmar contraseña" placeholderTextColor={T.textDim} secureTextEntry accessibilityLabel="Confirmar contraseña" />
        {pwError !== '' && <Text style={s.errorMsg}>{pwError}</Text>}
        {pwMsg !== '' && <Text style={s.successMsg}>{pwMsg}</Text>}
        <Pressable
          style={({ pressed }) => [s.btn, (!pwInput || savingPw) && s.btnOff, pressed && s.pressed]}
          onPress={handleChangePassword}
          disabled={savingPw || !pwInput}
          accessibilityRole="button"
        >
          <Text style={s.btnText}>{savingPw ? 'Actualizando...' : 'Cambiar contraseña'}</Text>
        </Pressable>
      </View>

      {/* Actions */}
      <View style={s.actionList}>
        <Pressable style={({ pressed }) => [s.actionRow, pressed && s.pressed]} onPress={() => navigation.navigate('Settings')}>
          <Text style={s.actionLabel}>Configuración</Text>
          <Text style={s.chevron}>›</Text>
        </Pressable>
        <View style={s.divider} />
        <Pressable style={({ pressed }) => [s.actionRow, pressed && s.pressed]} onPress={handleLogout}>
          <Text style={[s.actionLabel, { color: T.danger }]}>Cerrar sesión</Text>
        </Pressable>
        <View style={s.divider} />
        <Pressable style={({ pressed }) => [s.actionRow, pressed && s.pressed]} onPress={handleDeleteAccount}>
          <Text style={[s.actionLabel, { color: T.textDim, fontSize: 13 }]}>Eliminar cuenta y datos</Text>
        </Pressable>
      </View>

      <Text style={s.footer}>rosariodev · SplitBills</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: T.bg },
  content: { padding: 20, paddingBottom: 60, gap: 14 },
  center: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },

  identityBlock: { alignItems: 'center', paddingVertical: 28 },
  avatar: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarText: { color: T.bg, fontSize: 28, fontWeight: '900' },
  displayName: { fontSize: 22, fontWeight: '800', color: T.text, letterSpacing: -0.5, marginBottom: 4 },
  email: { fontSize: 14, color: T.textSec },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: T.surface, borderRadius: 14,
    padding: 16, gap: 4,
  },
  statValue: { fontSize: 30, fontWeight: '800', color: T.text, letterSpacing: -1 },
  statLabel: { fontSize: 9, fontWeight: '700', color: T.textDim, letterSpacing: 1.5 },

  section: { backgroundColor: T.surface, borderRadius: 16, padding: 16, gap: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: T.textDim, letterSpacing: 1.4 },
  input: {
    backgroundColor: T.surfaceAlt, borderWidth: 1, borderColor: T.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: T.text,
  },
  btn: {
    backgroundColor: T.accent, padding: 13, borderRadius: 12,
    alignItems: 'center', marginTop: 4,
  },
  btnOff: { opacity: 0.35 },
  btnText: { color: T.bg, fontSize: 15, fontWeight: '800' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  errorMsg: { color: T.danger, fontSize: 12 },
  successMsg: { color: T.success, fontSize: 12, fontWeight: '600' },

  actionList: { backgroundColor: T.surface, borderRadius: 16, overflow: 'hidden' },
  actionRow: { paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionLabel: { fontSize: 16, color: T.text, fontWeight: '500' },
  chevron: { fontSize: 20, color: T.textDim },
  divider: { height: 1, backgroundColor: T.border, marginLeft: 16 },

  footer: { textAlign: 'center', fontSize: 11, color: T.textDim, letterSpacing: 0.5, marginTop: 8 },
});

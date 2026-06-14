import { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput,
  Pressable, Alert, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { getSavedContacts, saveContact, deleteContact } from '../lib/splitService';
import { useColors } from '../lib/theme';
import { sanitize } from '../lib/validation';

type Contact = { id: string; name: string };

export default function ContactsScreen() {
  const T = useColors();
  const s = makeStyles(T);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setContacts(await getSavedContacts()); } catch {}
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdd = async () => {
    const name = sanitize(input);
    if (!name) return;
    if (contacts.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Duplicado', `"${name}" ya está en tus contactos.`);
      return;
    }
    setSaving(true);
    try {
      await saveContact(name);
      setInput('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      load();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el contacto.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (contact: Contact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Eliminar contacto', `¿Eliminar "${contact.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await deleteContact(contact.id);
            setContacts((p) => p.filter((c) => c.id !== contact.id));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Alert.alert('Error', 'No se pudo eliminar el contacto.');
          }
        },
      },
    ]);
  };

  return (
    <View style={s.container}>
      {/* Add row */}
      <View style={s.addCard}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Nombre del contacto"
          placeholderTextColor={T.textDim}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
          autoCapitalize="words"
        />
        <Pressable
          style={({ pressed }) => [s.addBtn, (!input.trim() || saving) && s.addBtnDisabled, pressed && s.pressed]}
          onPress={handleAdd}
          disabled={!input.trim() || saving}
        >
          <Text style={s.addBtnText}>{saving ? '...' : '+'}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={T.accent} /></View>
      ) : contacts.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyTitle}>Sin contactos aún</Text>
          <Text style={s.emptyBody}>Agrega personas frecuentes para sugerirlas al crear un divvi.</Text>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={s.list}>
            {contacts.map((contact, idx) => (
              <View key={contact.id}>
                <View style={s.row}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={s.name}>{contact.name}</Text>
                  <Pressable
                    onPress={() => handleDelete(contact)}
                    hitSlop={12}
                    style={({ pressed }) => [{ opacity: pressed ? 0.4 : 1 }]}
                  >
                    <Text style={s.deleteText}>×</Text>
                  </Pressable>
                </View>
                {idx < contacts.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (T: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: T.text },
  emptyBody: { fontSize: 14, color: T.textSec, textAlign: 'center', maxWidth: 260 },

  addCard: {
    flexDirection: 'row', gap: 10, padding: 16,
    backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  input: {
    flex: 1, backgroundColor: T.bg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: T.text,
    borderWidth: 1, borderColor: T.border,
  },
  addBtn: {
    backgroundColor: T.accent, borderRadius: 12,
    width: 44, alignItems: 'center', justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: T.textDim },
  addBtnText: { color: '#fff', fontSize: 24, fontWeight: '600', lineHeight: 28 },
  pressed: { opacity: 0.75 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  list: { backgroundColor: T.surface, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  avatar: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: T.accent + '18', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: T.accent },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: T.text },
  deleteText: { color: T.textDim, fontSize: 22, lineHeight: 24 },
  divider: { height: 1, backgroundColor: T.border, marginLeft: 64 },
});

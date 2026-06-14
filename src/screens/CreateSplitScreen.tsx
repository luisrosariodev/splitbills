import { useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  Pressable, ScrollView, Linking, Alert,
  Animated, LayoutAnimation, Platform, UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LAYOUT_SPRING = {
  duration: 320,
  create: { type: LayoutAnimation.Types.spring, property: LayoutAnimation.Properties.opacity, springDamping: 0.72 },
  update: { type: LayoutAnimation.Types.spring, springDamping: 0.72 },
  delete: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
};
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../types/navigation';
import { Person, Item } from '../types';
import { saveSplit, getRecentPeople } from '../lib/splitService';
import supabaseClient from '../lib/supabase';
import { addToQueue } from '../lib/offlineQueue';
import { notifySplitSaved } from '../lib/notifications';
import { validateSplitName, validateItemName, validatePrice, sanitize } from '../lib/validation';
import { getDefaultCurrency, getDefaultTip } from '../lib/settings';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateSplit'>;

import { useColors, AVATAR_PALETTE as AVATAR_COLORS } from '../lib/theme';

const CURRENCIES = ['$', '€', '£', '¥'];
const TIP_PRESETS = [10, 15, 18, 20];
const TAX_PRESETS = [7, 11.5];

type AddOnPreset = 0 | number | 'custom';
type AddOnMode = 'pct' | 'amt';
type AddOn = { preset: AddOnPreset; mode: AddOnMode; customVal: string };

const getAddOnAmount = (addon: AddOn, subtotal: number): number => {
  if (addon.preset === 0) return 0;
  if (addon.preset === 'custom') {
    const val = parseFloat(addon.customVal) || 0;
    return addon.mode === 'pct' ? subtotal * val / 100 : val;
  }
  return subtotal * (addon.preset as number) / 100;
};

const addonLabel = (addon: AddOn, currency = '$'): string => {
  if (addon.preset === 0) return '';
  if (addon.preset === 'custom') {
    const val = parseFloat(addon.customVal) || 0;
    return addon.mode === 'pct' ? `${val}%` : `${currency}${val.toFixed(2)}`;
  }
  return `${addon.preset}%`;
};

const initials = (name: string) => name.trim().charAt(0).toUpperCase();
const avatarColor = (idx: number) => AVATAR_COLORS[idx % AVATAR_COLORS.length];

// Fade-in wrapper using built-in Animated
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, bounciness: 4 }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// Scale-in for chips
function ScaleIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, delay, useNativeDriver: true, bounciness: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      {children}
    </Animated.View>
  );
}

function SavedAnimation() {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[savedAnimStyles.wrap, { opacity, transform: [{ scale }] }]}>
      <Text style={savedAnimStyles.check}>✓</Text>
      <Text style={savedAnimStyles.label}>divvi guardado</Text>
    </Animated.View>
  );
}
const savedAnimStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#EDFAF3', borderRadius: 12,
    paddingVertical: 12, marginBottom: 12,
  },
  check: { fontSize: 18, color: '#22C55E', fontWeight: '800' },
  label: { fontSize: 15, fontWeight: '700', color: '#16A34A' },
});

export default function CreateSplitScreen({ navigation }: Props) {
  const C = useColors();
  const styles = makeStyles(C);
  const [splitName, setSplitName] = useState('');
  const [currency, setCurrency] = useState('$');
  const [personInput, setPersonInput] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [recentPeople, setRecentPeople] = useState<string[]>([]);
  const [personFocused, setPersonFocused] = useState(false);
  const [itemNameInput, setItemNameInput] = useState('');
  const [itemPriceInput, setItemPriceInput] = useState('');
  const [items, setItems] = useState<Item[]>([]);

  const [tip, setTip] = useState<AddOn>({ preset: 0, mode: 'pct', customVal: '' });
  const [tax, setTax] = useState<AddOn>({ preset: 0, mode: 'pct', customVal: '' });

  useEffect(() => {
    Promise.all([getDefaultCurrency(), getDefaultTip(), getRecentPeople()]).then(([c, t, recent]) => {
      setCurrency(c as string);
      if ((t as number) > 0) setTip({ preset: t as number, mode: 'pct', customVal: '' });
      setRecentPeople(recent as string[]);
    }).catch(() => {});
  }, []);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const [personError, setPersonError] = useState('');
  const [itemError, setItemError] = useState('');

  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [receiptPhotoUri, setReceiptPhotoUri] = useState<string | null>(null);
  const lastScanRef = useRef(0);

  const handleScanReceipt = async () => {
    if (Date.now() - lastScanRef.current < 3000) return;
    lastScanRef.current = Date.now();

    const imgOptions = { mediaTypes: 'images' as const, allowsEditing: false, quality: 1 as const, base64: false };

    const result = await new Promise<ImagePicker.ImagePickerResult | null>((resolve) => {
      Alert.alert('Escanear recibo', undefined, [
        {
          text: 'Cámara',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.');
              resolve(null); return;
            }
            resolve(await ImagePicker.launchCameraAsync(imgOptions));
          },
        },
        {
          text: 'Fotos',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos.');
              resolve(null); return;
            }
            resolve(await ImagePicker.launchImageLibraryAsync(imgOptions));
          },
        },
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });

    if (!result || result.canceled || !result.assets?.[0]?.uri) return;

    setScanningReceipt(true);
    try {
      const asset = result.assets[0];
      const isLandscape = (asset.width ?? 0) > (asset.height ?? 0);

      const ctx = ImageManipulator.ImageManipulator.manipulate(asset.uri);
      if (isLandscape) ctx.rotate(-90);
      ctx.resize({ width: 1200 });
      const img = await ctx.renderAsync();
      const compressed = await img.saveAsync({
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      if (!compressed.base64) throw new Error('No se pudo comprimir la imagen.');

      const { data, error } = await supabaseClient.functions.invoke('ocr-receipt', {
        body: { image: compressed.base64 },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      let parsed: Array<{ name: string; price: number }> = data?.items ?? [];
      parsed = parsed.filter((p) => p.name && typeof p.price === 'number' && p.price > 0);

      if (parsed.length === 0) {
        Alert.alert('Sin items', 'No se encontraron items en este recibo.');
        return;
      }

      setReceiptPhotoUri(compressed.uri);
      setItems((prev) => [
        ...prev,
        ...parsed.map((p) => ({
          id: Date.now().toString() + Math.random(),
          name: p.name.slice(0, 60),
          price: p.price,
          assignedTo: [],
        })),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo procesar el recibo.');
    } finally {
      setScanningReceipt(false);
    }
  };

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [queued, setQueued] = useState(false);
  const [saveError, setSaveError] = useState('');
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    navigation.setOptions({ title: splitName.trim() || 'Nuevo divvi' });
  }, [splitName, navigation]);

  // ── People ───────────────────────────────────────────────
  const addPerson = () => {
    const name = sanitize(personInput);
    if (!name) return;
    if (name.length > 80) { setPersonError('Máximo 80 caracteres.'); return; }
    setPersonError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LAYOUT_SPRING);
    setPeople([...people, { id: Date.now().toString(), name }]);
    setPersonInput('');
  };

  const addPersonByName = (name: string) => {
    if (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LAYOUT_SPRING);
    setPeople((prev) => [...prev, { id: Date.now().toString(), name }]);
    setPersonInput('');
  };

  const confirmRemovePerson = (person: Person) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Eliminar persona', `¿Eliminar a ${person.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: () => {
          LayoutAnimation.configureNext(LAYOUT_SPRING);
          setPeople((p) => p.filter((x) => x.id !== person.id));
          setItems((prev) => prev.map((item) => ({
            ...item,
            assignedTo: item.assignedTo.filter((id) => id !== person.id),
          })));
        },
      },
    ]);
  };

  // ── Items ────────────────────────────────────────────────
  const addItem = () => {
    const nameErr = validateItemName(itemNameInput);
    if (nameErr) { setItemError(nameErr); return; }
    const priceErr = validatePrice(itemPriceInput);
    if (priceErr) { setItemError(priceErr); return; }
    setItemError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LAYOUT_SPRING);
    setItems([...items, {
      id: Date.now().toString(),
      name: sanitize(itemNameInput),
      price: parseFloat(itemPriceInput),
      assignedTo: [],
    }]);
    setItemNameInput('');
    setItemPriceInput('');
  };

  const startEditItem = (item: Item) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditPrice(item.price.toString());
  };

  const saveEditItem = () => {
    if (!editingItemId) return;
    const nameErr = validateItemName(editName);
    if (nameErr) { setItemError(nameErr); return; }
    const priceErr = validatePrice(editPrice);
    if (priceErr) { setItemError(priceErr); return; }
    setItemError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.map((item) =>
      item.id === editingItemId ? { ...item, name: editName.trim(), price: parseFloat(editPrice) } : item
    ));
    setEditingItemId(null);
  };

  const confirmRemoveItem = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Eliminar item', `¿Eliminar "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { LayoutAnimation.configureNext(LAYOUT_SPRING); setItems((p) => p.filter((i) => i.id !== item.id)); } },
    ]);
  };

  const toggleAssignment = (itemId: string, personId: string) => {
    Haptics.selectionAsync();
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const assigned = item.assignedTo.includes(personId);
      return {
        ...item,
        assignedTo: assigned
          ? item.assignedTo.filter((id) => id !== personId)
          : [...item.assignedTo, personId],
      };
    }));
  };

  const equalSplit = () => {
    if (people.length === 0 || items.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setItems((prev) => prev.map((item) => ({ ...item, assignedTo: people.map((p) => p.id) })));
  };

  // ── Calculations ─────────────────────────────────────────
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items]);
  const tipAmount = useMemo(() => getAddOnAmount(tip, subtotal), [tip, subtotal]);
  const taxAmount = useMemo(() => getAddOnAmount(tax, subtotal), [tax, subtotal]);
  const grandTotal = subtotal + tipAmount + taxAmount;

  const summary = useMemo(() => {
    const multiplier = subtotal > 0 ? grandTotal / subtotal : 1;
    return people.map((person) => {
      const personSubtotal = items.reduce((sum, item) => {
        if (!item.assignedTo.includes(person.id)) return sum;
        return sum + item.price / item.assignedTo.length;
      }, 0);
      return { person, total: personSubtotal * multiplier };
    });
  }, [people, items, grandTotal, subtotal]);

  // ── Save ─────────────────────────────────────────────────
  const isNetworkError = (e: any): boolean => {
    const msg = (e?.message ?? '').toLowerCase();
    return msg.includes('network request failed') || msg.includes('failed to fetch');
  };

  const handleSave = async () => {
    const nameErr = validateSplitName(splitName);
    if (nameErr) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Nombre inválido', nameErr);
      return;
    }
    setSaving(true);
    setSaved(false);
    setQueued(false);
    setSaveError('');
    try {
      const savedData = await saveSplit(splitName, people, items, tipAmount, taxAmount);
      if (!mountedRef.current) return;
      if (receiptPhotoUri && savedData?.id) {
        AsyncStorage.setItem(`receipt_photo_${savedData.id}`, receiptPhotoUri).catch(() => {});
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      notifySplitSaved(splitName);
      setSaved(true);
      setTimeout(() => { if (mountedRef.current) setSaved(false); }, 3000);
    } catch (err: any) {
      if (!mountedRef.current) return;
      if (isNetworkError(err)) {
        await addToQueue(splitName, people, items, tipAmount, taxAmount);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setQueued(true);
        setTimeout(() => { if (mountedRef.current) setQueued(false); }, 5000);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        console.error('Error al guardar:', JSON.stringify(err, null, 2));
        setSaveError(err?.message || 'Error al guardar. Intenta de nuevo.');
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const fmt = (n: number) => `${currency}${n.toFixed(2)}`;

  const shareOnWhatsApp = () => {
    let message = `*${splitName || 'Cuenta'}*\n\n`;

    summary.forEach(({ person, total }) => {
      message += `👤 *${person.name}* — ${fmt(total)}\n`;
      items.forEach((item) => {
        if (!item.assignedTo.includes(person.id)) return;
        const share = item.price / item.assignedTo.length;
        const others = item.assignedTo
          .filter((id) => id !== person.id)
          .map((id) => people.find((p) => p.id === id)?.name)
          .filter(Boolean) as string[];
        const sharedStr = others.length > 0 ? ` (con ${others.join(', ')})` : '';
        message += `  • ${item.name}${sharedStr}: ${fmt(share)}\n`;
      });
      message += '\n';
    });

    if (tipAmount > 0 || taxAmount > 0) {
      message += `Subtotal: ${fmt(subtotal)}\n`;
      if (tipAmount > 0) message += `Propina (${addonLabel(tip, currency)}): +${fmt(tipAmount)}\n`;
      if (taxAmount > 0) message += `Impuesto (${addonLabel(tax, currency)}): +${fmt(taxAmount)}\n`;
    }
    message += `*Total: ${fmt(grandTotal)}*`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
  };

  // ── AddOn section ─────────────────────────────────────────
  const renderAddOn = (
    label: string,
    presets: number[],
    state: AddOn,
    onChange: (next: AddOn) => void,
    isLast = false,
  ) => (
    <View style={[styles.addOnSection, !isLast && styles.addOnSectionBorder]}>
      <Text style={styles.addOnLabel}>{label}</Text>
      <View style={styles.tipRow}>
        <Pressable
          style={({ pressed }) => [styles.tipBtn, state.preset === 0 && styles.tipBtnActive, pressed && styles.btnPressed]}
          onPress={() => { Haptics.selectionAsync(); onChange({ ...state, preset: 0 }); }}
        >
          <Text style={[styles.tipBtnText, state.preset === 0 && styles.tipBtnTextActive]}>Ninguna</Text>
        </Pressable>
        {presets.map((pct) => (
          <Pressable
            key={pct}
            style={({ pressed }) => [styles.tipBtn, state.preset === pct && styles.tipBtnActive, pressed && styles.btnPressed]}
            onPress={() => { Haptics.selectionAsync(); onChange({ ...state, preset: pct }); }}
          >
            <Text style={[styles.tipBtnText, state.preset === pct && styles.tipBtnTextActive]}>{pct}%</Text>
          </Pressable>
        ))}
        <Pressable
          style={({ pressed }) => [styles.tipBtn, state.preset === 'custom' && styles.tipBtnActive, pressed && styles.btnPressed]}
          onPress={() => { Haptics.selectionAsync(); onChange({ ...state, preset: 'custom' }); }}
        >
          <Text style={[styles.tipBtnText, state.preset === 'custom' && styles.tipBtnTextActive]}>Otro</Text>
        </Pressable>
      </View>
      {state.preset === 'custom' && (
        <FadeIn>
          <View style={[styles.row, { marginTop: 10 }]}>
            <View style={styles.modeToggle}>
              <Pressable style={[styles.modeBtn, state.mode === 'pct' && styles.modeBtnActive]} onPress={() => onChange({ ...state, mode: 'pct' })}>
                <Text style={[styles.modeBtnText, state.mode === 'pct' && styles.modeBtnTextActive]}>%</Text>
              </Pressable>
              <Pressable style={[styles.modeBtn, state.mode === 'amt' && styles.modeBtnActive]} onPress={() => onChange({ ...state, mode: 'amt' })}>
                <Text style={[styles.modeBtnText, state.mode === 'amt' && styles.modeBtnTextActive]}>{currency}</Text>
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={state.mode === 'pct' ? '15.5' : '10.00'}
              placeholderTextColor={C.textMuted}
              value={state.customVal}
              onChangeText={(v) => onChange({ ...state, customVal: v })}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>
        </FadeIn>
      )}
    </View>
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Nombre + Moneda */}
      <View style={styles.card}>
        <Text style={styles.label}>NOMBRE DEL DIVVI</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Cena del viernes"
            placeholderTextColor={C.textMuted}
            value={splitName}
            onChangeText={setSplitName}
          />
          <View style={styles.currencyPicker}>
            {CURRENCIES.map((c) => (
              <Pressable
                key={c}
                style={[styles.currencyBtn, currency === c && styles.currencyBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setCurrency(c); }}
              >
                <Text style={[styles.currencyBtnText, currency === c && styles.currencyBtnTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Personas */}
      <View style={styles.card}>
        <Text style={styles.label}>PERSONAS</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Nombre"
            placeholderTextColor={C.textMuted}
            value={personInput}
            onChangeText={setPersonInput}
            onSubmitEditing={addPerson}
            onFocus={() => setPersonFocused(true)}
            onBlur={() => setPersonFocused(false)}
          />
          <Pressable style={({ pressed }) => [styles.addBtn, pressed && styles.btnPressed]} onPress={addPerson}>
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        </View>
        {personError !== '' && <Text style={styles.inlineError}>{personError}</Text>}
        {personFocused && (() => {
          const query = personInput.trim().toLowerCase();
          const suggestions = recentPeople.filter((name) =>
            !people.some((p) => p.name.toLowerCase() === name.toLowerCase()) &&
            (query === '' || name.toLowerCase().includes(query))
          ).slice(0, 6);
          if (suggestions.length === 0) return null;
          return (
            <View style={styles.suggestionsWrap}>
              <Text style={styles.suggestionsLabel}>
                {query === '' ? 'RECIENTES' : 'SUGERIDOS'}
              </Text>
              <View style={styles.suggestionsRow}>
                {suggestions.map((name) => (
                  <Pressable
                    key={name}
                    style={({ pressed }) => [styles.suggestionChip, pressed && { opacity: 0.7 }]}
                    onPress={() => addPersonByName(name)}
                  >
                    <View style={styles.suggestionAvatar}>
                      <Text style={styles.suggestionAvatarText}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.suggestionChipText}>{name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })()}
        {people.length === 0
          ? <Text style={styles.emptyHint}>Agrega personas para asignar items.</Text>
          : (
            <View style={styles.chips}>
              {people.map((p, idx) => (
                <ScaleIn key={p.id} delay={idx * 30}>
                  <View style={styles.chip}>
                    <View style={[styles.chipAvatar, { backgroundColor: avatarColor(idx) }]}>
                      <Text style={styles.chipAvatarText}>{initials(p.name)}</Text>
                    </View>
                    <Text style={styles.chipText}>{p.name}</Text>
                    <Pressable onPress={() => confirmRemovePerson(p)} style={styles.chipX} hitSlop={8}>
                      <Text style={styles.chipXText}>×</Text>
                    </Pressable>
                  </View>
                </ScaleIn>
              ))}
            </View>
          )
        }
      </View>

      {/* Items */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.label}>ITEMS</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={({ pressed }) => [styles.equalBtn, pressed && styles.btnPressed]}
              onPress={handleScanReceipt}
              disabled={scanningReceipt}
              accessibilityLabel="Escanear recibo con cámara"
              accessibilityRole="button"
            >
              <Text style={styles.equalBtnText}>{scanningReceipt ? '...' : 'Escanear'}</Text>
            </Pressable>
            {people.length > 0 && items.length > 0 && (
              <Pressable style={({ pressed }) => [styles.equalBtn, pressed && styles.btnPressed]} onPress={equalSplit} accessibilityLabel="Dividir igual entre todos" accessibilityRole="button">
                <Text style={styles.equalBtnText}>Dividir igual</Text>
              </Pressable>
            )}
          </View>
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="Nombre"
            placeholderTextColor={C.textMuted}
            value={itemNameInput}
            onChangeText={setItemNameInput}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="0.00"
            placeholderTextColor={C.textMuted}
            value={itemPriceInput}
            onChangeText={setItemPriceInput}
            keyboardType="decimal-pad"
          />
          <Pressable style={({ pressed }) => [styles.addBtn, pressed && styles.btnPressed]} onPress={addItem}>
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        </View>

        {itemError !== '' && <Text style={styles.inlineError}>{itemError}</Text>}
        {items.length === 0 && (
          <Text style={styles.scanHint}>Escanear con IA · verifica precios antes de guardar.</Text>
        )}
        {items.length === 0
          ? <Text style={styles.emptyHint}>Agrega items para calcular el divvi.</Text>
          : items.map((item, idx) => (
            <FadeIn key={item.id} delay={idx === items.length - 1 ? 0 : 0}>
              <View style={[styles.itemRow, idx === 0 && styles.itemRowFirst]}>
                {editingItemId === item.id ? (
                  <View>
                    <View style={styles.row}>
                      <TextInput style={[styles.input, { flex: 2 }]} value={editName} onChangeText={setEditName} autoFocus />
                      <TextInput style={[styles.input, { flex: 1 }]} value={editPrice} onChangeText={setEditPrice} keyboardType="decimal-pad" />
                    </View>
                    <View style={[styles.row, { marginTop: 8 }]}>
                      <Pressable style={({ pressed }) => [styles.editSaveBtn, pressed && styles.btnPressed]} onPress={saveEditItem}>
                        <Text style={styles.editSaveBtnText}>Guardar</Text>
                      </Pressable>
                      <Pressable style={({ pressed }) => [styles.editCancelBtn, pressed && styles.btnPressed]} onPress={() => setEditingItemId(null)}>
                        <Text style={styles.editCancelBtnText}>Cancelar</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={styles.itemRight}>
                        <Text style={styles.itemPrice}>{fmt(item.price)}</Text>
                        <Pressable onPress={() => startEditItem(item)} hitSlop={8} style={styles.itemAction}>
                          <Text style={styles.itemActionText}>Editar</Text>
                        </Pressable>
                        <Pressable onPress={() => confirmRemoveItem(item)} hitSlop={8}>
                          <Text style={styles.itemDeleteText}>×</Text>
                        </Pressable>
                      </View>
                    </View>
                    {people.length > 0 && (
                      <View style={styles.chips}>
                        {people.map((person, pidx) => {
                          const assigned = item.assignedTo.includes(person.id);
                          return (
                            <Pressable
                              key={person.id}
                              style={({ pressed }) => [styles.chip, assigned && styles.chipActive, pressed && styles.btnPressed]}
                              onPress={() => toggleAssignment(item.id, person.id)}
                            >
                              <View style={[styles.chipAvatar, { backgroundColor: assigned ? C.accent + '22' : avatarColor(pidx) }]}>
                                <Text style={[styles.chipAvatarText, assigned && { color: C.accent }]}>
                                  {initials(person.name)}
                                </Text>
                              </View>
                              <Text style={[styles.chipText, assigned && styles.chipTextActive]}>{person.name}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>
            </FadeIn>
          ))
        }
      </View>

      {/* Propina + IVU */}
      {items.length > 0 && (
        <FadeIn>
          <View style={styles.card}>
            {renderAddOn('PROPINA', TIP_PRESETS, tip, setTip, false)}
            {renderAddOn('IVA / IVU / FEE', TAX_PRESETS, tax, setTax, true)}
          </View>
        </FadeIn>
      )}

      {/* Resumen */}
      {summary.length > 0 && (
        <FadeIn delay={50}>
          <View style={styles.card}>
            <Text style={styles.label}>RESUMEN</Text>

            {summary.map(({ person, total }, idx) => (
              <FadeIn key={person.id} delay={idx * 50}>
                <View style={[styles.summaryRow, idx === summary.length - 1 && styles.summaryRowLast]}>
                  <View style={styles.summaryLeft}>
                    <View style={[styles.summaryAvatar, { backgroundColor: avatarColor(idx) }]}>
                      <Text style={styles.summaryAvatarText}>{initials(person.name)}</Text>
                    </View>
                    <Text style={styles.summaryName}>{person.name}</Text>
                  </View>
                  <Text style={styles.summaryAmount}>{fmt(total)}</Text>
                </View>
              </FadeIn>
            ))}

            <View style={styles.breakdownSection}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Subtotal</Text>
                <Text style={styles.breakdownValue}>{fmt(subtotal)}</Text>
              </View>
              {tipAmount > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Propina ({addonLabel(tip, currency)})</Text>
                  <Text style={styles.breakdownValue}>+{fmt(tipAmount)}</Text>
                </View>
              )}
              {taxAmount > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Impuesto ({addonLabel(tax, currency)})</Text>
                  <Text style={styles.breakdownValue}>+{fmt(taxAmount)}</Text>
                </View>
              )}
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalAmount}>{fmt(grandTotal)}</Text>
            </View>

            {saveError !== '' && <Text style={styles.errorText}>{saveError}</Text>}

            {saved && <SavedAnimation />}
            {queued && (
              <FadeIn>
                <View style={styles.queuedBanner}>
                  <Text style={styles.queuedText}>Sin conexión — se sincronizará al reconectar</Text>
                </View>
              </FadeIn>
            )}

            <View style={styles.actionButtons}>
              <Pressable
                style={({ pressed }) => [styles.saveBtn, (saving || saved) && styles.saveBtnDisabled, pressed && styles.btnPressed]}
                onPress={handleSave}
                disabled={saving || saved}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar divvi'}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.whatsappBtn, pressed && styles.btnPressed]}
                onPress={shareOnWhatsApp}
              >
                <Text style={styles.whatsappBtnText}>Compartir por WhatsApp</Text>
              </Pressable>
            </View>
          </View>
        </FadeIn>
      )}
    </ScrollView>
  );
}

const makeStyles = (C: ReturnType<typeof useColors>) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 60, gap: 12 },

  card: { backgroundColor: C.surface, borderRadius: 16, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', color: C.textSub, letterSpacing: 0.8, marginBottom: 12 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 16, color: C.text, backgroundColor: C.surfaceAlt,
  },

  addBtn: { backgroundColor: C.accent, width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 26, fontWeight: '400', lineHeight: 30 },
  btnPressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },

  currencyPicker: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  currencyBtn: { paddingHorizontal: 10, paddingVertical: 10, backgroundColor: C.surfaceAlt },
  currencyBtnActive: { backgroundColor: C.accent },
  currencyBtnText: { fontSize: 15, fontWeight: '600', color: C.textSub },
  currencyBtnTextActive: { color: '#fff' },

  equalBtn: { backgroundColor: C.accentSubtle, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  equalBtnText: { color: C.accent, fontSize: 12, fontWeight: '600' },

  emptyHint: { color: C.textMuted, fontSize: 13, marginTop: 12, textAlign: 'center' },
  scanHint: { color: C.textDim, fontSize: 11, textAlign: 'center', marginTop: 6 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center',
    paddingLeft: 6, paddingRight: 8, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: C.border, gap: 6,
  },
  chipActive: { backgroundColor: C.accentSubtle, borderColor: C.accent },
  chipAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chipAvatarText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  chipText: { color: C.textSub, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: C.accent, fontWeight: '600' },
  chipX: { paddingHorizontal: 2 },
  chipXText: { color: C.textMuted, fontSize: 16, lineHeight: 18 },

  itemRow: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 12, paddingTop: 12 },
  itemRowFirst: { marginTop: 14 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  itemName: { fontSize: 15, fontWeight: '600', color: C.text, flex: 1 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemPrice: { fontSize: 15, fontWeight: '700', color: C.accent },
  itemAction: { padding: 2 },
  itemActionText: { color: C.accent, fontSize: 12, fontWeight: '500' },
  itemDeleteText: { color: C.textMuted, fontSize: 20, lineHeight: 22 },

  editSaveBtn: { flex: 1, backgroundColor: C.accent, padding: 10, borderRadius: 10, alignItems: 'center' },
  editSaveBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  editCancelBtn: { flex: 1, backgroundColor: C.bg, padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  editCancelBtnText: { color: C.textSub, fontWeight: '600', fontSize: 14 },

  addOnSection: { paddingVertical: 16 },
  addOnSectionBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  addOnLabel: { fontSize: 11, fontWeight: '600', color: C.textSub, letterSpacing: 0.8, marginBottom: 10 },
  tipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tipBtn: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  tipBtnActive: { backgroundColor: C.accentSubtle, borderColor: C.accent },
  tipBtnText: { fontSize: 13, fontWeight: '500', color: C.textSub },
  tipBtnTextActive: { color: C.accent, fontWeight: '700' },
  modeToggle: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.bg },
  modeBtnActive: { backgroundColor: C.accent },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: C.textSub },
  modeBtnTextActive: { color: '#fff' },

  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryAvatar: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  summaryAvatarText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  summaryName: { fontSize: 15, color: C.text },
  summaryAmount: { fontSize: 15, fontWeight: '700', color: C.text },

  breakdownSection: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginTop: 4, gap: 5 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 13, color: C.textSub },
  breakdownValue: { fontSize: 13, color: C.textSub, fontWeight: '500' },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingTop: 14, paddingBottom: 20, borderTopWidth: 1, borderTopColor: C.border, marginTop: 8,
  },
  totalLabel: { fontSize: 11, fontWeight: '600', color: C.textSub, letterSpacing: 0.8 },
  totalAmount: { fontSize: 32, fontWeight: '800', color: C.text, letterSpacing: -1 },

  errorText: { color: C.danger, fontSize: 13, textAlign: 'center', marginBottom: 10 },
  successBanner: {
    backgroundColor: C.successBg, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginBottom: 12,
  },
  successText: { color: C.success, fontSize: 14, fontWeight: '600' },

  actionButtons: { gap: 10 },
  saveBtn: { backgroundColor: C.success, padding: 16, borderRadius: 14, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: C.textMuted },
  saveBtnText: { color: C.bg, fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },
  whatsappBtn: { backgroundColor: C.whatsapp, padding: 16, borderRadius: 14, alignItems: 'center' },
  whatsappBtnText: { color: C.bg, fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },

  inlineError: { color: C.danger, fontSize: 12, marginTop: 6 },

  suggestionsWrap: { marginTop: 10, gap: 8 },
  suggestionsLabel: {
    fontSize: 9, fontWeight: '700', color: C.textMuted,
    letterSpacing: 1.4,
  },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.surfaceAlt, borderRadius: 18,
    paddingLeft: 5, paddingRight: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: C.border,
  },
  suggestionAvatar: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  suggestionAvatarText: { fontSize: 10, fontWeight: '700', color: C.accent },
  suggestionChipText: { fontSize: 13, fontWeight: '500', color: C.text },
  queuedBanner: {
    backgroundColor: C.warningBg, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginBottom: 12,
  },
  queuedText: { color: C.warning, fontSize: 13, fontWeight: '600' },
});

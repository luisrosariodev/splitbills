import { useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable,
  ScrollView, Alert, Animated, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../types/navigation';
import { Person, Item } from '../types';
import { getSplitDetail, updateSplit } from '../lib/splitService';
import { validateSplitName, validateItemName, validatePrice, sanitize } from '../lib/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'EditSplit'>;

import { useColors, AVATAR_PALETTE as AVATAR_COLORS } from '../lib/theme';
const CURRENCIES = ['$', '€', '£', '¥'];
const TIP_PRESETS = [10, 15, 18, 20];
const TAX_PRESETS = [7, 11.5];
type AddOnPreset = 0 | number | 'custom';
type AddOnMode = 'pct' | 'amt';
type AddOn = { preset: AddOnPreset; mode: AddOnMode; customVal: string };

const getAddOnAmount = (addon: AddOn, subtotal: number) => {
  if (addon.preset === 0) return 0;
  if (addon.preset === 'custom') {
    const val = parseFloat(addon.customVal) || 0;
    return addon.mode === 'pct' ? subtotal * val / 100 : val;
  }
  return subtotal * (addon.preset as number) / 100;
};
const addonLabel = (addon: AddOn, currency = '$') => {
  if (addon.preset === 0) return '';
  if (addon.preset === 'custom') {
    const val = parseFloat(addon.customVal) || 0;
    return addon.mode === 'pct' ? `${val}%` : `${currency}${val.toFixed(2)}`;
  }
  return `${addon.preset}%`;
};
const initials = (name: string) => name.trim().charAt(0).toUpperCase();
const avatarColor = (idx: number) => AVATAR_COLORS[idx % AVATAR_COLORS.length];

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, bounciness: 4 }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export default function EditSplitScreen({ route, navigation }: Props) {
  const C = useColors();
  const styles = makeStyles(C);
  const { splitId } = route.params;
  const [loadingDetail, setLoadingDetail] = useState(true);

  const [splitName, setSplitName] = useState('');
  const [currency, setCurrency] = useState('$');
  const [personInput, setPersonInput] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [itemNameInput, setItemNameInput] = useState('');
  const [itemPriceInput, setItemPriceInput] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [tip, setTip] = useState<AddOn>({ preset: 0, mode: 'pct', customVal: '' });
  const [tax, setTax] = useState<AddOn>({ preset: 0, mode: 'pct', customVal: '' });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [itemError, setItemError] = useState('');
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    getSplitDetail(splitId)
      .then((detail) => {
        setSplitName(detail.name);
        const loadedPeople = detail.people.map((p) => ({ id: p.id, name: p.name }));
        setPeople(loadedPeople);
        setItems(detail.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price),
          assignedTo: item.item_assignments.map((a) => a.person_id),
        })));
        const tip = Number(detail.tip_amount ?? 0);
        const tax = Number(detail.tax_amount ?? 0);
        const subtotal = detail.items.reduce((s, i) => s + Number(i.price), 0);
        if (tip > 0 && subtotal > 0) {
          const pct = Math.round((tip / subtotal) * 100);
          if (TIP_PRESETS.includes(pct)) setTip({ preset: pct, mode: 'pct', customVal: '' });
          else setTip({ preset: 'custom', mode: 'amt', customVal: tip.toFixed(2) });
        }
        if (tax > 0 && subtotal > 0) {
          const pct = parseFloat(((tax / subtotal) * 100).toFixed(1));
          if (TAX_PRESETS.includes(pct)) setTax({ preset: pct, mode: 'pct', customVal: '' });
          else setTax({ preset: 'custom', mode: 'amt', customVal: tax.toFixed(2) });
        }
      })
      .catch(() => Alert.alert('Error', 'No se pudo cargar el divvi.'))
      .finally(() => setLoadingDetail(false));
  }, [splitId]);

  useEffect(() => {
    navigation.setOptions({ title: splitName.trim() || 'Editar divvi' });
  }, [splitName, navigation]);

  const addPerson = () => {
    const name = sanitize(personInput);
    if (!name || name.length > 80) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPeople([...people, { id: Date.now().toString(), name }]);
    setPersonInput('');
  };

  const removePerson = (person: Person) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Eliminar persona', `¿Eliminar a ${person.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: () => {
          setPeople((p) => p.filter((x) => x.id !== person.id));
          setItems((prev) => prev.map((item) => ({
            ...item, assignedTo: item.assignedTo.filter((id) => id !== person.id),
          })));
        },
      },
    ]);
  };

  const addItem = () => {
    const nameErr = validateItemName(itemNameInput);
    if (nameErr) { setItemError(nameErr); return; }
    const priceErr = validatePrice(itemPriceInput);
    if (priceErr) { setItemError(priceErr); return; }
    setItemError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems([...items, {
      id: Date.now().toString(),
      name: sanitize(itemNameInput),
      price: parseFloat(itemPriceInput),
      assignedTo: [],
    }]);
    setItemNameInput('');
    setItemPriceInput('');
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

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items]);
  const tipAmount = useMemo(() => getAddOnAmount(tip, subtotal), [tip, subtotal]);
  const taxAmount = useMemo(() => getAddOnAmount(tax, subtotal), [tax, subtotal]);
  const grandTotal = subtotal + tipAmount + taxAmount;

  const summary = useMemo(() => {
    const multiplier = subtotal > 0 ? grandTotal / subtotal : 1;
    return people.map((person) => ({
      person,
      total: items.reduce((sum, item) => {
        if (!item.assignedTo.includes(person.id)) return sum;
        return sum + item.price / item.assignedTo.length;
      }, 0) * multiplier,
    }));
  }, [people, items, grandTotal, subtotal]);

  const handleSave = async () => {
    const nameErr = validateSplitName(splitName);
    if (nameErr) { Alert.alert('Nombre inválido', nameErr); return; }
    setSaving(true); setSaved(false); setSaveError('');
    try {
      await updateSplit(splitId, splitName, people, items, tipAmount, taxAmount);
      if (!mountedRef.current) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      setTimeout(() => { if (mountedRef.current) navigation.goBack(); }, 1200);
    } catch (err: any) {
      if (!mountedRef.current) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSaveError(err?.message || 'Error al guardar.');
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const fmt = (n: number) => `${currency}${n.toFixed(2)}`;

  if (loadingDetail) {
    return <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Nombre + Moneda */}
      <View style={styles.card}>
        <Text style={styles.label}>NOMBRE DEL DIVVI</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={splitName}
            onChangeText={setSplitName}
            placeholder="Cena del viernes"
            placeholderTextColor={C.textMuted}
            accessibilityLabel="Nombre del divvi"
          />
          <View style={styles.currencyPicker}>
            {CURRENCIES.map((c) => (
              <Pressable
                key={c}
                style={[styles.currencyBtn, currency === c && styles.currencyBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setCurrency(c); }}
                accessibilityLabel={`Moneda ${c}`}
                accessibilityRole="button"
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
            accessibilityLabel="Nombre de persona"
          />
          <Pressable style={({ pressed }) => [styles.addBtn, pressed && styles.btnPressed]} onPress={addPerson} accessibilityLabel="Agregar persona" accessibilityRole="button">
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        </View>
        {people.length > 0 && (
          <View style={styles.chips}>
            {people.map((p, idx) => (
              <View key={p.id} style={styles.chip}>
                <View style={[styles.chipAvatar, { backgroundColor: avatarColor(idx) }]}>
                  <Text style={styles.chipAvatarText}>{initials(p.name)}</Text>
                </View>
                <Text style={styles.chipText}>{p.name}</Text>
                <Pressable onPress={() => removePerson(p)} style={styles.chipX} hitSlop={8} accessibilityLabel={`Eliminar ${p.name}`} accessibilityRole="button">
                  <Text style={styles.chipXText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Items */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.label}>ITEMS</Text>
          {people.length > 0 && items.length > 0 && (
            <Pressable style={({ pressed }) => [styles.equalBtn, pressed && styles.btnPressed]} onPress={equalSplit} accessibilityLabel="Dividir igual entre todos" accessibilityRole="button">
              <Text style={styles.equalBtnText}>Dividir igual</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 2 }]} placeholder="Nombre" placeholderTextColor={C.textMuted} value={itemNameInput} onChangeText={setItemNameInput} accessibilityLabel="Nombre del item" />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="0.00" placeholderTextColor={C.textMuted} value={itemPriceInput} onChangeText={setItemPriceInput} keyboardType="decimal-pad" accessibilityLabel="Precio del item" />
          <Pressable style={({ pressed }) => [styles.addBtn, pressed && styles.btnPressed]} onPress={addItem} accessibilityLabel="Agregar item" accessibilityRole="button">
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        </View>
        {itemError !== '' && <Text style={styles.inlineError}>{itemError}</Text>}
        {items.map((item, idx) => (
          <FadeIn key={item.id}>
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
                      <Pressable onPress={() => { setEditingItemId(item.id); setEditName(item.name); setEditPrice(item.price.toString()); }} hitSlop={8} style={styles.itemAction} accessibilityLabel={`Editar ${item.name}`} accessibilityRole="button">
                        <Text style={styles.itemActionText}>Editar</Text>
                      </Pressable>
                      <Pressable onPress={() => setItems((p) => p.filter((i) => i.id !== item.id))} hitSlop={8} accessibilityLabel={`Eliminar ${item.name}`} accessibilityRole="button">
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
                            accessibilityLabel={`${assigned ? 'Quitar' : 'Asignar'} ${person.name}`}
                            accessibilityRole="button"
                          >
                            <View style={[styles.chipAvatar, { backgroundColor: assigned ? C.accent + '22' : avatarColor(pidx) }]}>
                              <Text style={[styles.chipAvatarText, assigned && { color: C.accent }]}>{initials(person.name)}</Text>
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
        ))}
      </View>

      {/* Propina + IVU */}
      {items.length > 0 && (
        <View style={styles.card}>
          {[
            { label: 'PROPINA', presets: TIP_PRESETS, state: tip, onChange: setTip, isLast: false },
            { label: 'IVA / IVU / FEE', presets: TAX_PRESETS, state: tax, onChange: setTax, isLast: true },
          ].map(({ label, presets, state, onChange, isLast }) => (
            <View key={label} style={[styles.addOnSection, !isLast && styles.addOnSectionBorder]}>
              <Text style={styles.addOnLabel}>{label}</Text>
              <View style={styles.tipRow}>
                <Pressable style={[styles.tipBtn, state.preset === 0 && styles.tipBtnActive]} onPress={() => { Haptics.selectionAsync(); onChange({ ...state, preset: 0 }); }} accessibilityRole="button" accessibilityLabel="Sin propina">
                  <Text style={[styles.tipBtnText, state.preset === 0 && styles.tipBtnTextActive]}>Ninguna</Text>
                </Pressable>
                {presets.map((pct) => (
                  <Pressable key={pct} style={[styles.tipBtn, state.preset === pct && styles.tipBtnActive]} onPress={() => { Haptics.selectionAsync(); onChange({ ...state, preset: pct }); }} accessibilityRole="button" accessibilityLabel={`${pct}%`}>
                    <Text style={[styles.tipBtnText, state.preset === pct && styles.tipBtnTextActive]}>{pct}%</Text>
                  </Pressable>
                ))}
                <Pressable style={[styles.tipBtn, state.preset === 'custom' && styles.tipBtnActive]} onPress={() => { Haptics.selectionAsync(); onChange({ ...state, preset: 'custom' }); }} accessibilityRole="button" accessibilityLabel="Cantidad personalizada">
                  <Text style={[styles.tipBtnText, state.preset === 'custom' && styles.tipBtnTextActive]}>Otro</Text>
                </Pressable>
              </View>
              {state.preset === 'custom' && (
                <View style={[styles.row, { marginTop: 10 }]}>
                  <View style={styles.modeToggle}>
                    <Pressable style={[styles.modeBtn, state.mode === 'pct' && styles.modeBtnActive]} onPress={() => onChange({ ...state, mode: 'pct' })} accessibilityRole="button" accessibilityLabel="Porcentaje">
                      <Text style={[styles.modeBtnText, state.mode === 'pct' && styles.modeBtnTextActive]}>%</Text>
                    </Pressable>
                    <Pressable style={[styles.modeBtn, state.mode === 'amt' && styles.modeBtnActive]} onPress={() => onChange({ ...state, mode: 'amt' })} accessibilityRole="button" accessibilityLabel="Cantidad fija">
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
                    accessibilityLabel="Valor personalizado"
                  />
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Resumen */}
      {summary.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>RESUMEN</Text>
          {summary.map(({ person, total }, idx) => (
            <View key={person.id} style={[styles.summaryRow, idx === summary.length - 1 && styles.summaryRowLast]}>
              <View style={styles.summaryLeft}>
                <View style={[styles.summaryAvatar, { backgroundColor: avatarColor(idx) }]}>
                  <Text style={styles.summaryAvatarText}>{initials(person.name)}</Text>
                </View>
                <Text style={styles.summaryName}>{person.name}</Text>
              </View>
              <Text style={styles.summaryAmount}>{fmt(total)}</Text>
            </View>
          ))}
          <View style={styles.breakdownSection}>
            <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Subtotal</Text><Text style={styles.breakdownValue}>{fmt(subtotal)}</Text></View>
            {tipAmount > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Propina ({addonLabel(tip, currency)})</Text><Text style={styles.breakdownValue}>+{fmt(tipAmount)}</Text></View>}
            {taxAmount > 0 && <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Impuesto ({addonLabel(tax, currency)})</Text><Text style={styles.breakdownValue}>+{fmt(taxAmount)}</Text></View>}
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalAmount}>{fmt(grandTotal)}</Text>
          </View>

          {saveError !== '' && <Text style={styles.errorText}>{saveError}</Text>}
          {saved && (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>Cambios guardados</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.saveBtn, saving && styles.saveBtnDisabled, pressed && styles.btnPressed]}
            onPress={handleSave}
            disabled={saving}
            accessibilityLabel="Guardar cambios"
            accessibilityRole="button"
          >
            <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (C: ReturnType<typeof useColors>) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 60, gap: 12 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.surface, borderRadius: 16, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', color: C.textSub, letterSpacing: 0.8, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.text, backgroundColor: C.surfaceAlt },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', paddingLeft: 6, paddingRight: 8, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.border, gap: 6 },
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
  inlineError: { color: C.danger, fontSize: 12, marginTop: 6 },
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
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
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
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 14, paddingBottom: 20, borderTopWidth: 1, borderTopColor: C.border, marginTop: 8 },
  totalLabel: { fontSize: 11, fontWeight: '600', color: C.textSub, letterSpacing: 0.8 },
  totalAmount: { fontSize: 32, fontWeight: '800', color: C.text, letterSpacing: -1 },
  errorText: { color: C.danger, fontSize: 13, textAlign: 'center', marginBottom: 10 },
  successBanner: { backgroundColor: C.successBg, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 12 },
  successText: { color: C.success, fontSize: 14, fontWeight: '600' },
  saveBtn: { backgroundColor: C.success, padding: 16, borderRadius: 14, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: C.textMuted },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

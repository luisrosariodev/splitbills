import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getDefaultCurrency, setDefaultCurrency, getDefaultTip, setDefaultTip } from '../lib/settings';
import { T } from '../lib/theme';

const CURRENCIES = ['$', '€', '£', '¥'];
const TIP_PRESETS = [0, 10, 15, 18, 20];

export default function SettingsScreen() {
  const [currency, setCurrencyState] = useState('$');
  const [tip, setTipState] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDefaultCurrency(), getDefaultTip()])
      .then(([c, t]) => { setCurrencyState(c); setTipState(t); })
      .finally(() => setLoading(false));
  }, []);

  const handleCurrency = async (v: string) => {
    Haptics.selectionAsync();
    setCurrencyState(v);
    await setDefaultCurrency(v);
  };

  const handleTip = async (v: number) => {
    Haptics.selectionAsync();
    setTipState(v);
    await setDefaultTip(v);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={T.accent} /></View>;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>

      <View style={s.section}>
        <Text style={s.sectionLabel}>MONEDA POR DEFECTO</Text>
        <View style={s.optionRow}>
          {CURRENCIES.map((c) => (
            <Pressable
              key={c}
              style={({ pressed }) => [s.chip, currency === c && s.chipActive, pressed && s.pressed]}
              onPress={() => handleCurrency(c)}
              accessibilityRole="button"
              accessibilityLabel={`Moneda ${c}`}
              accessibilityState={{ selected: currency === c }}
            >
              <Text style={[s.chipText, currency === c && s.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionLabel}>PROPINA POR DEFECTO</Text>
        <View style={s.optionRow}>
          {TIP_PRESETS.map((p) => (
            <Pressable
              key={p}
              style={({ pressed }) => [s.chip, tip === p && s.chipActive, pressed && s.pressed]}
              onPress={() => handleTip(p)}
              accessibilityRole="button"
              accessibilityLabel={p === 0 ? 'Sin propina' : `${p}%`}
              accessibilityState={{ selected: tip === p }}
            >
              <Text style={[s.chipText, tip === p && s.chipTextActive]}>
                {p === 0 ? 'Ninguna' : `${p}%`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={s.hint}>
        Se aplican al abrir un nuevo split.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: T.bg },
  content: { padding: 20, paddingBottom: 60, gap: 14 },
  center: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },

  section: { backgroundColor: T.surface, borderRadius: 16, padding: 16, gap: 14 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: T.textDim, letterSpacing: 1.4 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  chip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22,
    borderWidth: 1, borderColor: T.border, backgroundColor: T.surfaceAlt,
  },
  chipActive: { backgroundColor: T.accentDim, borderColor: T.accent },
  chipText: { fontSize: 14, fontWeight: '500', color: T.textSec },
  chipTextActive: { color: T.accent, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.82 },

  hint: { fontSize: 12, color: T.textDim, textAlign: 'center', letterSpacing: 0.2 },
});

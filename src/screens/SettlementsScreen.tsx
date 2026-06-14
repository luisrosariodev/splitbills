import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView,
  ActivityIndicator, Pressable, TextInput, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../types/navigation';
import {
  getSplitDetail, getSettlements, recordPayment, deleteSettlement,
  Settlement, SplitDetail, computePersonShares, computeNetDebts,
} from '../lib/splitService';
import { notifyPaymentSettled } from '../lib/notifications';
import { getDefaultCurrency } from '../lib/settings';
import { useColors, GRADIENT } from '../lib/theme';
import PressScale from '../components/PressScale';

type Props = NativeStackScreenProps<RootStackParamList, 'Settlements'>;

export default function SettlementsScreen({ route }: Props) {
  const T = useColors();
  const s = makeStyles(T);
  const { splitId } = route.params;

  const [detail, setDetail] = useState<SplitDetail | null>(null);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  const [currency, setCurrency] = useState('$');
  const [payers, setPayers] = useState<Set<string>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [showCustom, setShowCustom] = useState(false);
  const [payersLocked, setPayersLocked] = useState(false);

  // key → settlementId for undo
  const pendingUndo = useRef<Record<string, { timerId: ReturnType<typeof setTimeout>; sid: string }>>({});
  const [justPaid, setJustPaid] = useState<Set<string>>(new Set());

  const load = async () => {
    getDefaultCurrency().then((c) => setCurrency(c)).catch(() => {});
    const [d, h] = await Promise.all([getSplitDetail(splitId), getSettlements(splitId)]);
    setDetail(d);
    setHistory(h);
    setLoading(false);

    // Auto-infer payer from existing settlements
    const settled = h.filter((x) => x.settled);
    if (settled.length > 0) {
      const inferredPayers = new Set(settled.map((x) => x.payee_name));
      setPayers(inferredPayers);
      setPayersLocked(true);
    }
  };

  useEffect(() => { load(); }, [splitId]);
  useEffect(() => () => {
    Object.values(pendingUndo.current).forEach((p) => clearTimeout(p.timerId));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={T.accent} /></View>;
  if (!detail) return <View style={s.center}><Text style={{ color: T.danger }}>Error cargando.</Text></View>;

  const shares = computePersonShares(detail);
  const total = shares.reduce((sum, p) => sum + p.amount, 0);

  const resolvedPaid: Record<string, number> = {};
  if (payers.size > 0) {
    if (showCustom) {
      detail.people.forEach((p) => {
        resolvedPaid[p.name] = parseFloat(customAmounts[p.name] ?? '0') || 0;
      });
    } else {
      const share = total / payers.size;
      payers.forEach((name) => { resolvedPaid[name] = share; });
    }
  }

  const allDebts = payers.size > 0 ? computeNetDebts(detail, resolvedPaid) : [];

  // Build map of already-paid amounts per debtor→creditor pair
  const paidMap: Record<string, number> = {};
  history.filter((x) => x.settled).forEach((x) => {
    const key = `${x.payer_name}→${x.payee_name}`;
    paidMap[key] = (paidMap[key] ?? 0) + Number(x.amount);
  });

  // Only show debts with remaining balance
  const debts = allDebts.map((d) => {
    const key = `${d.debtor}→${d.creditor}`;
    const remaining = d.amount - (paidMap[key] ?? 0);
    return { ...d, remaining };
  }).filter((d) => d.remaining > 0.005);

  const done = history.filter((x) => x.settled);
  const debtKey = (debtor: string, creditor: string) => `${debtor}→${creditor}`;

  const handleTogglePayer = (name: string) => {
    if (payersLocked) {
      Alert.alert(
        'Pagador bloqueado',
        'Ya hay pagos registrados para esta selección. ¿Quieres cambiarla de todas formas? Esto no borrará los pagos ya registrados.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cambiar', onPress: () => {
            setPayersLocked(false);
            setPayers((prev) => {
              const next = new Set(prev);
              if (next.has(name)) next.delete(name); else next.add(name);
              return next;
            });
          }},
        ],
      );
      return;
    }
    Haptics.selectionAsync();
    setPayers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleMarkPaid = async (debt: { debtor: string; creditor: string; remaining: number }) => {
    const key = debtKey(debt.debtor, debt.creditor);
    if (justPaid.has(key)) return;

    // Check not already fully paid
    if (debt.remaining <= 0.005) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setJustPaid((p) => new Set(p).add(key));
    setPayersLocked(true);

    let sid: string;
    try {
      sid = await recordPayment(splitId, debt.debtor, debt.creditor, debt.remaining);
      notifyPaymentSettled(debt.debtor, debt.remaining);
    } catch {
      setJustPaid((p) => { const n = new Set(p); n.delete(key); return n; });
      Alert.alert('Error', 'No se pudo registrar el pago.');
      return;
    }

    const timerId = setTimeout(async () => {
      delete pendingUndo.current[key];
      setJustPaid((p) => { const n = new Set(p); n.delete(key); return n; });
      await load();
    }, 4000);

    pendingUndo.current[key] = { timerId, sid };
  };

  const handleUndo = async (key: string) => {
    const entry = pendingUndo.current[key];
    if (!entry) return;
    clearTimeout(entry.timerId);
    delete pendingUndo.current[key];
    setJustPaid((p) => { const n = new Set(p); n.delete(key); return n; });
    try { await deleteSettlement(entry.sid); } catch {}
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCopy = async (debt: { debtor: string; creditor: string; remaining: number }) => {
    const msg = `Hola ${debt.debtor}, te toca ${currency}${debt.remaining.toFixed(2)} de ${detail.name} 🙏`;
    await Clipboard.setStringAsync(msg);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copiado', 'Pega en ATH Móvil, Zelle, Apple Cash o iMessage.');
  };

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Quién cubrió */}
      <View style={s.block}>
        <View style={s.blockHeader}>
          <Text style={s.blockLabel}>QUIÉN CUBRIÓ LA CUENTA</Text>
          {payersLocked && payers.size > 0 && (
            <Pressable onPress={() => {
              Alert.alert('Cambiar pagador', 'Ya hay pagos registrados. ¿Cambiar la selección?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Cambiar', onPress: () => setPayersLocked(false) },
              ]);
            }}>
              <Text style={s.editLink}>Editar</Text>
            </Pressable>
          )}
        </View>
        <View style={s.chipRow}>
          {detail.people.map((p) => {
            const active = payers.has(p.name);
            return (
              <Pressable
                key={p.id}
                style={({ pressed }) => [s.chip, active && s.chipActive, payersLocked && active && s.chipLocked, pressed && s.chipPressed]}
                onPress={() => handleTogglePayer(p.name)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {payers.size > 1 && !payersLocked && (
          <Pressable onPress={() => setShowCustom((v) => !v)} style={s.customToggle}>
            <Text style={s.customToggleText}>
              {showCustom ? 'Dividir igual entre pagadores' : 'Ingresar montos distintos'}
            </Text>
          </Pressable>
        )}

        {payers.size > 1 && showCustom && !payersLocked && (
          <View style={s.amountInputs}>
            {[...payers].map((name) => (
              <View key={name} style={s.amountRow}>
                <Text style={s.amountName}>{name}</Text>
                <TextInput
                  style={s.amountInput}
                  value={customAmounts[name] ?? ''}
                  onChangeText={(v) => setCustomAmounts((p) => ({ ...p, [name]: v }))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={T.textDim}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Deudas pendientes */}
      {payers.size > 0 && debts.length > 0 && (
        <View style={s.block}>
          <Text style={s.blockLabel}>PAGOS PENDIENTES</Text>
          {debts.map((debt, i) => {
            const key = debtKey(debt.debtor, debt.creditor);
            const paying = justPaid.has(key);
            return (
              <View key={key} style={[s.debtRow, i > 0 && s.debtRowBorder]}>
                <View style={s.debtAvatar}>
                  <Text style={s.debtAvatarText}>{debt.debtor.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={s.debtMid}>
                  <Text style={s.debtName}>{debt.debtor}</Text>
                  <Text style={s.debtSub}>→ {debt.creditor}</Text>
                </View>
                <View style={s.debtEnd}>
                  <Text style={s.debtAmt}>{currency}{debt.remaining.toFixed(2)}</Text>
                  {paying ? (
                    <Pressable onPress={() => handleUndo(key)} style={s.undoBtn}>
                      <Text style={s.undoBtnText}>Deshacer</Text>
                    </Pressable>
                  ) : (
                    <View style={s.debtActions}>
                      <PressScale onPress={() => handleCopy(debt)} haptic="light">
                        <View style={s.copyBtn}>
                          <Text style={s.copyBtnText}>Copiar</Text>
                        </View>
                      </PressScale>
                      <PressScale onPress={() => handleMarkPaid(debt)} haptic="medium">
                        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.paidBtn}>
                          <Text style={s.paidBtnText}>Pagado ✓</Text>
                        </LinearGradient>
                      </PressScale>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {payers.size > 0 && debts.length === 0 && allDebts.length >= 0 && (
        <View style={s.allGoodCard}>
          <Text style={s.allGoodIcon}>✓</Text>
          <Text style={s.allGoodTitle}>Todo saldado</Text>
          <Text style={s.allGoodSub}>No quedan pagos pendientes.</Text>
        </View>
      )}

      {/* Historial */}
      {done.length > 0 && (
        <View style={s.block}>
          <Text style={s.blockLabel}>PAGADO</Text>
          {done.map((h, i) => (
            <View key={h.id} style={[s.historyRow, i > 0 && s.debtRowBorder]}>
              <View style={s.debtMid}>
                <Text style={s.historyName}>{h.payer_name} → {h.payee_name}</Text>
              </View>
              <Text style={s.historyAmt}>{currency}{Number(h.amount).toFixed(2)}</Text>
              <View style={s.badgeDone}>
                <Text style={s.badgeDoneText}>Pagado</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {payers.size === 0 && done.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>¿Quién cubrió la cuenta?</Text>
          <Text style={s.emptyBody}>
            Selecciona quién(es) pagaron en el restaurante. divvi calcula cuánto le debe cada quien.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (T: ReturnType<typeof useColors>) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: T.bg },
  content: { padding: 20, paddingBottom: 60, gap: 12 },
  center: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },

  block: {
    backgroundColor: T.surface, borderRadius: 18,
    padding: 18, borderWidth: 1, borderColor: T.border, gap: 14,
  },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockLabel: { fontSize: 10, fontWeight: '700', color: T.accent, letterSpacing: 1.6 },
  editLink: { fontSize: 13, color: T.accent, fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24,
    borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg,
  },
  chipActive: { backgroundColor: T.accent, borderColor: T.accent },
  chipLocked: { opacity: 0.85 },
  chipPressed: { opacity: 0.75 },
  chipText: { fontSize: 15, fontWeight: '600', color: T.textSec },
  chipTextActive: { color: '#fff' },

  customToggle: { alignSelf: 'flex-start' },
  customToggleText: { fontSize: 13, color: T.accent, fontWeight: '600' },

  amountInputs: { gap: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amountName: { flex: 1, fontSize: 15, fontWeight: '600', color: T.text },
  amountInput: {
    borderWidth: 1.5, borderColor: T.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 15, color: T.text, width: 90, textAlign: 'right',
    backgroundColor: T.surfaceAlt,
  },

  debtRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  debtRowBorder: { borderTopWidth: 1, borderTopColor: T.border },
  debtAvatar: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: T.accentDim, alignItems: 'center', justifyContent: 'center',
  },
  debtAvatarText: { fontSize: 15, fontWeight: '700', color: T.accent },
  debtMid: { flex: 1 },
  debtName: { fontSize: 15, fontWeight: '600', color: T.text },
  debtSub: { fontSize: 12, color: T.textSec, marginTop: 1 },
  debtEnd: { alignItems: 'flex-end', gap: 6 },
  debtAmt: { fontSize: 18, fontWeight: '800', color: T.text, letterSpacing: -0.4 },
  debtActions: { flexDirection: 'row', gap: 6 },
  copyBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9,
    borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg,
  },
  copyBtnText: { color: T.textSec, fontSize: 12, fontWeight: '700' },
  paidBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  paidBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  undoBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: T.warningBg },
  undoBtnText: { color: T.warning, fontSize: 12, fontWeight: '700' },

  allGoodCard: {
    backgroundColor: T.successBg, borderRadius: 18,
    padding: 24, alignItems: 'center', gap: 6,
  },
  allGoodIcon: { fontSize: 32, color: T.success },
  allGoodTitle: { fontSize: 17, fontWeight: '700', color: T.success },
  allGoodSub: { fontSize: 13, color: T.success, opacity: 0.8 },

  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  historyName: { fontSize: 14, fontWeight: '500', color: T.textDim },
  historyAmt: { fontSize: 15, fontWeight: '700', color: T.textDim },
  badgeDone: { backgroundColor: T.successBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeDoneText: { color: T.success, fontSize: 12, fontWeight: '700' },

  empty: { paddingTop: 40, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: T.text },
  emptyBody: { fontSize: 14, color: T.textSec, textAlign: 'center', lineHeight: 21, maxWidth: 280 },
});

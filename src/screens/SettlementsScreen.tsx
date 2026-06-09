import { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView,
  ActivityIndicator, Alert, Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../types/navigation';
import {
  getSplitDetail, getSettlements, createSettlement,
  markSettled, Settlement, SplitDetail,
} from '../lib/splitService';
import { T, GRADIENT } from '../lib/theme';
import PressScale from '../components/PressScale';

type Props = NativeStackScreenProps<RootStackParamList, 'Settlements'>;

function computeShares(detail: SplitDetail): Array<{ name: string; amount: number }> {
  const subtotal = detail.items.reduce((s, i) => s + Number(i.price), 0);
  const tip = Number(detail.tip_amount ?? 0);
  const tax = Number(detail.tax_amount ?? 0);
  const multiplier = subtotal > 0 ? (subtotal + tip + tax) / subtotal : 1;

  const nameById: Record<string, string> = {};
  detail.people.forEach((p) => { nameById[p.id] = p.name; });

  const shares: Record<string, number> = {};
  detail.people.forEach((p) => { shares[p.name] = 0; });

  detail.items.forEach((item) => {
    const assigned = item.item_assignments.map((a) => a.person_id);
    if (assigned.length === 0) return;
    const share = (Number(item.price) * multiplier) / assigned.length;
    assigned.forEach((pid) => {
      if (nameById[pid]) shares[nameById[pid]] = (shares[nameById[pid]] ?? 0) + share;
    });
  });

  return detail.people.map((p) => ({ name: p.name, amount: shares[p.name] ?? 0 }));
}

export default function SettlementsScreen({ route }: Props) {
  const { splitId } = route.params;
  const [detail, setDetail] = useState<SplitDetail | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState<string | null>(null);
  const [payer, setPayer] = useState<string | null>(null);

  const load = async () => {
    const [d, s] = await Promise.all([getSplitDetail(splitId), getSettlements(splitId)]);
    setDetail(d);
    setSettlements(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, [splitId]);

  const handleMarkSettled = (s: Settlement) => {
    Alert.alert(
      'Confirmar pago',
      `${s.payer_name} pagó $${s.amount.toFixed(2)} a ${s.payee_name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', onPress: async () => {
            setSettling(s.id);
            try {
              await markSettled(s.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await load();
            } catch { Alert.alert('Error', 'No se pudo registrar.'); }
            finally { setSettling(null); }
          },
        },
      ],
    );
  };

  const handleRegister = (payerName: string, payeeName: string, amount: number) => {
    Alert.alert(
      'Registrar pago',
      `${payerName} paga $${amount.toFixed(2)} a ${payeeName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Registrar', onPress: async () => {
            try {
              await createSettlement(splitId, payerName, payeeName, amount);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await load();
            } catch { Alert.alert('Error', 'No se pudo registrar.'); }
          },
        },
      ],
    );
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={T.accent} /></View>;
  if (!detail) return <View style={s.center}><Text style={{ color: T.danger }}>Error cargando.</Text></View>;

  const shares = computeShares(detail);
  const pending = settlements.filter((x) => !x.settled);
  const done = settlements.filter((x) => x.settled);

  const pendingPayers = new Set(
    payer ? pending.filter((st) => st.payee_name === payer).map((st) => st.payer_name) : [],
  );

  const debts = payer ? shares.filter((p) => p.name !== payer && p.amount > 0.01) : [];

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Quién pagó */}
      <View style={s.block}>
        <Text style={s.blockLabel}>QUIÉN PAGÓ LA CUENTA</Text>
        <View style={s.chipRow}>
          {detail.people.map((person) => {
            const active = payer === person.name;
            return (
              <Pressable
                key={person.id}
                style={({ pressed }) => [s.chip, active && s.chipActive, pressed && s.chipPressed]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPayer((p) => (p === person.name ? null : person.name));
                }}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{person.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Debts */}
      {payer && debts.length > 0 && (
        <View style={s.block}>
          <Text style={s.blockLabel}>DEBEN A {payer.toUpperCase()}</Text>
          <View style={s.debtList}>
            {debts.map((d, i) => (
              <View key={d.name} style={[s.debtRow, i > 0 && s.debtRowBorder]}>
                <View style={s.debtAvatar}>
                  <Text style={s.debtAvatarText}>{d.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={s.debtMid}>
                  <Text style={s.debtName}>{d.name}</Text>
                  <Text style={s.debtSub}>debe a {payer}</Text>
                </View>
                <View style={s.debtEnd}>
                  <Text style={s.debtAmt}>${d.amount.toFixed(2)}</Text>
                  {pendingPayers.has(d.name) ? (
                    <View style={s.pendingInlineBadge}>
                      <Text style={s.pendingInlineText}>Pendiente</Text>
                    </View>
                  ) : (
                    <PressScale onPress={() => handleRegister(d.name, payer, d.amount)} haptic="medium">
                      <LinearGradient
                        colors={GRADIENT}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.regBtn}
                      >
                        <Text style={s.regBtnText}>Registrar</Text>
                      </LinearGradient>
                    </PressScale>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {payer && debts.length === 0 && (
        <View style={s.hintRow}>
          <Text style={s.hintText}>
            Los demás no tienen gastos asignados en este divvi.
          </Text>
        </View>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <View style={s.block}>
          <Text style={s.blockLabel}>PENDIENTES</Text>
          <View style={s.settleList}>
            {pending.map((st, i) => (
              <PressScale
                key={st.id}
                onPress={() => handleMarkSettled(st)}
                haptic="light"
                disabled={settling === st.id}
              >
                <View style={[s.settleRow, i > 0 && s.settleRowBorder]}>
                  <View style={s.settleMid}>
                    <Text style={s.settleName}>{st.payer_name} → {st.payee_name}</Text>
                    <Text style={s.settleAmt}>${st.amount.toFixed(2)}</Text>
                  </View>
                  <View style={s.badge}>
                    <Text style={s.badgePendingText}>
                      {settling === st.id ? '...' : 'Pendiente'}
                    </Text>
                  </View>
                </View>
              </PressScale>
            ))}
          </View>
        </View>
      )}

      {/* Done */}
      {done.length > 0 && (
        <View style={s.block}>
          <Text style={s.blockLabel}>COMPLETADOS</Text>
          <View style={s.settleList}>
            {done.map((st, i) => (
              <View key={st.id} style={[s.settleRow, s.settleRowDone, i > 0 && s.settleRowBorder]}>
                <View style={s.settleMid}>
                  <Text style={[s.settleName, { color: T.textDim }]}>{st.payer_name} → {st.payee_name}</Text>
                  <Text style={[s.settleAmt, { color: T.textDim }]}>${st.amount.toFixed(2)}</Text>
                </View>
                <View style={s.badgeDone}>
                  <Text style={s.badgeDoneText}>Pagado</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {!payer && pending.length === 0 && done.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Selecciona quién pagó</Text>
          <Text style={s.emptyBody}>
            Toca el nombre de la persona que cubrió la cuenta para ver cuánto le debe cada uno.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: T.bg },
  content: { padding: 20, paddingBottom: 60, gap: 12 },
  center: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },

  block: {
    backgroundColor: T.surface,
    borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: T.border,
    gap: 14,
  },
  blockLabel: {
    fontSize: 10, fontWeight: '700',
    color: T.accent, letterSpacing: 1.6,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 24, borderWidth: 1.5,
    borderColor: T.border, backgroundColor: T.bg,
  },
  chipActive: { backgroundColor: T.accent, borderColor: T.accent },
  chipPressed: { opacity: 0.75 },
  chipText: { fontSize: 15, fontWeight: '600', color: T.textSec },
  chipTextActive: { color: '#fff' },

  debtList: { gap: 0 },
  debtRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 12,
  },
  debtRowBorder: { borderTopWidth: 1, borderTopColor: T.border },
  debtAvatar: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: T.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  debtAvatarText: { fontSize: 15, fontWeight: '700', color: T.accent },
  debtMid: { flex: 1 },
  debtName: { fontSize: 15, fontWeight: '600', color: T.text },
  debtSub: { fontSize: 12, color: T.textSec, marginTop: 1 },
  debtEnd: { alignItems: 'flex-end', gap: 6 },
  debtAmt: { fontSize: 18, fontWeight: '800', color: T.text, letterSpacing: -0.4 },
  regBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  regBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  pendingInlineBadge: { backgroundColor: T.warningBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  pendingInlineText: { color: T.warning, fontSize: 11, fontWeight: '700' },

  hintRow: { paddingVertical: 8, paddingHorizontal: 4 },
  hintText: { fontSize: 14, color: T.textSec, lineHeight: 20 },

  settleList: { gap: 0 },
  settleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 10,
  },
  settleRowBorder: { borderTopWidth: 1, borderTopColor: T.border },
  settleRowDone: { opacity: 0.55 },
  settleMid: { flex: 1 },
  settleName: { fontSize: 14, fontWeight: '600', color: T.text, marginBottom: 2 },
  settleAmt: { fontSize: 16, fontWeight: '800', color: T.accent },

  badge: {
    backgroundColor: T.warningBg, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgePendingText: { color: T.warning, fontSize: 12, fontWeight: '700' },
  badgeDone: {
    backgroundColor: T.successBg, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeDoneText: { color: T.success, fontSize: 12, fontWeight: '700' },

  empty: { paddingTop: 40, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: T.text },
  emptyBody: {
    fontSize: 14, color: T.textSec,
    textAlign: 'center', lineHeight: 21, maxWidth: 270,
  },
});

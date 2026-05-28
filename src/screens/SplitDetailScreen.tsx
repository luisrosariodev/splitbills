import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { getSplitDetail } from '../lib/splitService';

type Props = NativeStackScreenProps<RootStackParamList, 'SplitDetail'>;

const C = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  border: '#E5E5EA',
  accent: '#007AFF',
  text: '#1C1C1E',
  textSub: '#6C6C70',
  textMuted: '#AEAEB2',
};

type Detail = Awaited<ReturnType<typeof getSplitDetail>>;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

export default function SplitDetailScreen({ route }: Props) {
  const { splitId } = route.params;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSplitDetail(splitId)
      .then(setDetail)
      .catch(() => setError('No se pudo cargar el split.'))
      .finally(() => setLoading(false));
  }, [splitId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>;
  }

  if (error || !detail) {
    return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;
  }

  const personMap: Record<string, string> = {};
  detail.people.forEach((p) => { personMap[p.id] = p.name; });

  const summary = detail.people.map((person) => ({
    name: person.name,
    total: detail.items.reduce((sum, item) => {
      const assigned = item.item_assignments.map((a) => a.person_id);
      if (!assigned.includes(person.id)) return sum;
      return sum + Number(item.price) / assigned.length;
    }, 0),
  }));

  const grandTotal = detail.items.reduce((sum, item) => sum + Number(item.price), 0);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.date}>{formatDate(detail.created_at)}</Text>

      {/* Items */}
      <View style={styles.card}>
        <Text style={styles.label}>ITEMS</Text>
        {detail.items.map((item, idx) => {
          const assigned = item.item_assignments.map((a) => personMap[a.person_id]).filter(Boolean);
          return (
            <View key={item.id} style={[styles.itemRow, idx === 0 && styles.itemRowFirst]}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>${Number(item.price).toFixed(2)}</Text>
              </View>
              {assigned.length > 0 && (
                <Text style={styles.itemAssigned}>{assigned.join(', ')}</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Resumen */}
      <View style={styles.card}>
        <Text style={styles.label}>RESUMEN</Text>
        {summary.map(({ name, total }, idx) => (
          <View
            key={name}
            style={[styles.summaryRow, idx === summary.length - 1 && styles.summaryRowLast]}
          >
            <Text style={styles.summaryName}>{name}</Text>
            <Text style={styles.summaryAmount}>${total.toFixed(2)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalAmount}>${grandTotal.toFixed(2)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 60, gap: 12 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#FF3B30', fontSize: 15 },
  date: { fontSize: 13, color: C.textSub, marginBottom: 4 },
  card: { backgroundColor: C.surface, borderRadius: 16, padding: 16 },
  label: { fontSize: 11, fontWeight: '600', color: C.textSub, letterSpacing: 0.8 },
  itemRow: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 12, paddingTop: 12 },
  itemRowFirst: { marginTop: 14 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  itemName: { fontSize: 15, fontWeight: '600', color: C.text, flex: 1 },
  itemPrice: { fontSize: 15, fontWeight: '700', color: C.accent },
  itemAssigned: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryName: { fontSize: 15, color: C.text },
  summaryAmount: { fontSize: 15, fontWeight: '600', color: C.text },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginTop: 4,
  },
  totalLabel: { fontSize: 11, fontWeight: '600', color: C.textSub, letterSpacing: 0.8 },
  totalAmount: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.8 },
});

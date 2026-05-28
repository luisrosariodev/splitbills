import { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView,
  ActivityIndicator, Pressable, Linking, Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { getGroupDetail, buildGroupMessage, SplitDetail } from '../lib/splitService';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

const C = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  border: '#E5E5EA',
  accent: '#007AFF',
  whatsapp: '#25D366',
  text: '#1C1C1E',
  textSub: '#6C6C70',
  textMuted: '#AEAEB2',
  danger: '#FF3B30',
};
const AVATAR_COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#00C7BE'];
const avatarColor = (idx: number) => AVATAR_COLORS[idx % AVATAR_COLORS.length];
const initials = (name: string) => name.trim().charAt(0).toUpperCase();
const fmt = (n: number) => `$${n.toFixed(2)}`;

function FadeInView({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, bounciness: 4 }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

type PersonRow = {
  displayName: string;
  total: number;
  splitData: Array<{
    name: string;
    total: number;
    items: Array<{ name: string; share: number; sharedWith: string[] }>;
  }>;
};

const aggregatePeople = (splits: SplitDetail[]): PersonRow[] => {
  const map: Record<string, PersonRow> = {};

  splits.forEach((split) => {
    const nameById: Record<string, string> = {};
    split.people.forEach((p) => { nameById[p.id] = p.name; });

    const subtotal = split.items.reduce((s, i) => s + Number(i.price), 0);
    const tip = Number(split.tip_amount ?? 0);
    const tax = Number(split.tax_amount ?? 0);
    const multiplier = subtotal > 0 ? (subtotal + tip + tax) / subtotal : 1;

    split.people.forEach((person) => {
      const key = person.name.toLowerCase().trim();
      if (!map[key]) map[key] = { displayName: person.name, total: 0, splitData: [] };

      let personSubtotal = 0;
      const items: PersonRow['splitData'][0]['items'] = [];

      split.items.forEach((item) => {
        const assignedIds = item.item_assignments.map((a) => a.person_id);
        if (!assignedIds.includes(person.id)) return;
        const share = Number(item.price) / assignedIds.length;
        personSubtotal += share;
        const sharedWith = assignedIds
          .filter((id) => id !== person.id)
          .map((id) => nameById[id])
          .filter(Boolean);
        items.push({ name: item.name, share, sharedWith });
      });

      if (personSubtotal > 0) {
        const personTotal = personSubtotal * multiplier;
        map[key].total += personTotal;
        map[key].splitData.push({ name: split.name, total: personTotal, items });
      }
    });
  });

  return Object.values(map).sort((a, b) => b.total - a.total);
};

export default function GroupDetailScreen({ route, navigation }: Props) {
  const { groupId, groupName } = route.params;
  const [splits, setSplits] = useState<SplitDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getGroupDetail(groupId)
      .then(setSplits)
      .catch(() => setError('No se pudo cargar el grupo.'))
      .finally(() => setLoading(false));
  }, [groupId]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>;
  if (error) return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;

  const people = aggregatePeople(splits);
  const grandTotal = people.reduce((s, p) => s + p.total, 0);

  const shareOnWhatsApp = () => {
    const msg = buildGroupMessage(groupName, splits);
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Summary strip */}
      <FadeInView>
        <View style={styles.summaryStrip}>
          <Text style={styles.summaryStripLabel}>{splits.length} splits · {people.length} personas</Text>
          <Text style={styles.summaryStripTotal}>{fmt(grandTotal)}</Text>
        </View>
      </FadeInView>

      {/* Per person */}
      {people.map((person, idx) => (
        <FadeInView key={person.displayName} delay={idx * 60}>
          <View style={styles.card}>
            {/* Person header */}
            <View style={styles.personHeader}>
              <View style={[styles.avatar, { backgroundColor: avatarColor(idx) }]}>
                <Text style={styles.avatarText}>{initials(person.displayName)}</Text>
              </View>
              <Text style={styles.personName}>{person.displayName}</Text>
              <Text style={styles.personTotal}>{fmt(person.total)}</Text>
            </View>

            {/* Splits breakdown */}
            {person.splitData.map((splitRow, sidx) => (
              <View key={sidx} style={styles.splitBlock}>
                <View style={styles.splitBlockHeader}>
                  <Text style={styles.splitBlockPlace}>📍 {splitRow.name}</Text>
                  <Text style={styles.splitBlockTotal}>{fmt(splitRow.total)}</Text>
                </View>
                {splitRow.items.map((item, iidx) => (
                  <View key={iidx} style={styles.itemLine}>
                    <Text style={styles.itemDot}>•</Text>
                    <Text style={styles.itemText} numberOfLines={1}>
                      {item.name}
                      {item.sharedWith.length > 0 && (
                        <Text style={styles.itemShared}>{` (con ${item.sharedWith.join(', ')})`}</Text>
                      )}
                    </Text>
                    <Text style={styles.itemShare}>{fmt(item.share)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </FadeInView>
      ))}

      {/* Share */}
      <FadeInView delay={people.length * 60 + 50}>
        <Pressable
          style={({ pressed }) => [styles.whatsappBtn, pressed && styles.btnPressed]}
          onPress={shareOnWhatsApp}
        >
          <Text style={styles.whatsappBtnText}>Compartir por WhatsApp</Text>
        </Pressable>
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 60, gap: 12 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: C.danger, fontSize: 15 },

  summaryStrip: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
  },
  summaryStripLabel: { fontSize: 13, color: C.textSub },
  summaryStripTotal: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.8 },

  card: { backgroundColor: C.surface, borderRadius: 16, padding: 16 },

  personHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  personName: { flex: 1, fontSize: 16, fontWeight: '700', color: C.text },
  personTotal: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.5 },

  splitBlock: {
    borderTopWidth: 1, borderTopColor: C.border,
    paddingTop: 10, marginTop: 8, gap: 4,
  },
  splitBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  splitBlockPlace: { fontSize: 13, fontWeight: '600', color: C.textSub, flex: 1 },
  splitBlockTotal: { fontSize: 13, fontWeight: '700', color: C.accent },

  itemLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 4 },
  itemDot: { fontSize: 12, color: C.textMuted, marginTop: 1 },
  itemText: { flex: 1, fontSize: 13, color: C.text },
  itemShared: { color: C.textMuted },
  itemShare: { fontSize: 13, fontWeight: '600', color: C.text },

  whatsappBtn: { backgroundColor: C.whatsapp, padding: 16, borderRadius: 14, alignItems: 'center' },
  whatsappBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnPressed: { transform: [{ scale: 0.97 }], opacity: 0.88 },
});

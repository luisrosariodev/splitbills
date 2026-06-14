import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { getFullStats } from '../lib/splitService';
import { useColors, GRADIENT, AVATAR_PALETTE } from '../lib/theme';
import { useScreenAnimation } from '../hooks/useScreenAnimation';
import { Animated } from 'react-native';
import { SkeletonCard } from '../components/SkeletonLoader';

type Stats = Awaited<ReturnType<typeof getFullStats>>;

const avatarColor = (i: number) => AVATAR_PALETTE[i % AVATAR_PALETTE.length];

export default function StatsScreen() {
  const T = useColors();
  const s = makeStyles(T);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const anims = useScreenAnimation(4, { stagger: 90, duration: 420 });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { setStats(await getFullStats()); } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(true); };

  if (loading) return (
    <View style={[s.scroll, { padding: 20, gap: 14 }]}>
      <View style={{ height: 110, backgroundColor: T.border, borderRadius: 20, opacity: 0.5 }} />
      <SkeletonCard rows={2} />
      <SkeletonCard rows={3} />
    </View>
  );

  if (!stats) return (
    <View style={s.center}><Text style={s.empty}>Sin datos aún.</Text></View>
  );

  const monthChange = stats.lastMonth > 0
    ? ((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100
    : 0;
  const maxBar = Math.max(stats.thisMonth, stats.lastMonth, 1);

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
    >

      {/* Header stat */}
      <Animated.View style={anims[0]}>
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroCard}>
          <Text style={s.heroLabel}>TOTAL DIVIDIDO</Text>
          <Text style={s.heroAmount}>${stats.totalEstimated.toFixed(0)}</Text>
          <Text style={s.heroSub}>{stats.splitCount} divvis en total</Text>
        </LinearGradient>
      </Animated.View>

      {/* Este mes vs mes pasado */}
      <Animated.View style={anims[1]}>
        <View style={s.card}>
          <Text style={s.cardLabel}>ESTE MES VS MES PASADO</Text>
          <View style={s.barsRow}>
            <View style={s.barGroup}>
              <Text style={s.barAmount}>${stats.lastMonth.toFixed(0)}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { height: `${(stats.lastMonth / maxBar) * 100}%`, backgroundColor: T.border }]} />
              </View>
              <Text style={s.barLabel}>Anterior</Text>
            </View>
            <View style={s.barGroup}>
              <Text style={[s.barAmount, { color: T.accent }]}>${stats.thisMonth.toFixed(0)}</Text>
              <View style={s.barTrack}>
                <LinearGradient
                  colors={GRADIENT}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 0, y: 0 }}
                  style={[s.barFill, { height: `${(stats.thisMonth / maxBar) * 100}%` }]}
                />
              </View>
              <Text style={[s.barLabel, { color: T.accent }]}>Este mes</Text>
            </View>
          </View>
          {monthChange !== 0 && (
            <View style={[s.changeBadge, { backgroundColor: monthChange > 0 ? T.dangerBg : T.successBg }]}>
              <Text style={[s.changeText, { color: monthChange > 0 ? T.danger : T.success }]}>
                {monthChange > 0 ? '+' : ''}{monthChange.toFixed(0)}% vs mes pasado
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Top personas */}
      {stats.topPeople.length > 0 && (
        <Animated.View style={anims[2]}>
          <View style={s.card}>
            <Text style={s.cardLabel}>PERSONAS FRECUENTES</Text>
            <View style={s.peopleList}>
              {stats.topPeople.map((p, i) => (
                <View key={p.name} style={s.personRow}>
                  <View style={[s.personAvatar, { backgroundColor: avatarColor(i) }]}>
                    <Text style={s.personAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={s.personName}>{p.name}</Text>
                  <View style={s.personCountBadge}>
                    <Text style={s.personCount}>{p.count} divvi{p.count > 1 ? 's' : ''}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      )}

      {/* Datos vacíos */}
      {stats.splitCount === 0 && (
        <Animated.View style={anims[3]}>
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>📊</Text>
            <Text style={s.emptyTitle}>Aún sin datos</Text>
            <Text style={s.emptyBody}>Crea tu primer divvi para ver las estadísticas aquí.</Text>
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const makeStyles = (T: ReturnType<typeof useColors>) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: T.bg },
  content: { padding: 20, paddingBottom: 60, gap: 14 },
  center: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
  empty: { color: T.textDim, fontSize: 15 },

  heroCard: { borderRadius: 20, padding: 24, gap: 4 },
  heroLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.6 },
  heroAmount: { fontSize: 48, fontWeight: '800', color: '#fff', letterSpacing: -2 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  card: { backgroundColor: T.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: T.border },
  cardLabel: { fontSize: 10, fontWeight: '700', color: T.accent, letterSpacing: 1.6, marginBottom: 18 },

  barsRow: { flexDirection: 'row', gap: 16, justifyContent: 'center', alignItems: 'flex-end', height: 140 },
  barGroup: { alignItems: 'center', gap: 6, width: 72 },
  barAmount: { fontSize: 14, fontWeight: '700', color: T.textSec },
  barTrack: {
    width: 44, height: 100, backgroundColor: T.surfaceAlt,
    borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 8, minHeight: 4 },
  barLabel: { fontSize: 11, color: T.textDim, fontWeight: '600' },

  changeBadge: {
    marginTop: 14, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'center',
  },
  changeText: { fontSize: 12, fontWeight: '700' },

  peopleList: { gap: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personAvatar: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  personAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  personName: { flex: 1, fontSize: 15, color: T.text, fontWeight: '500' },
  personCountBadge: { backgroundColor: T.accentDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  personCount: { fontSize: 12, color: T.accent, fontWeight: '700' },

  emptyCard: { backgroundColor: T.surface, borderRadius: 18, padding: 28, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: T.border },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: T.text },
  emptyBody: { fontSize: 14, color: T.textSec, textAlign: 'center', maxWidth: 240 },
});

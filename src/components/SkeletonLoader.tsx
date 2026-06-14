import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useColors } from '../lib/theme';

type SkeletonStyles = ReturnType<typeof makeStyles>;

function Bone({ style, s }: { style?: ViewStyle; s: SkeletonStyles }) {
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  return (
    <Animated.View style={[s.bone, style, { opacity: anim }]} />
  );
}

function SkeletonRow({ s }: { s: SkeletonStyles }) {
  return (
    <View style={s.row}>
      <Bone style={s.avatar} s={s} />
      <View style={s.lines}>
        <Bone style={s.lineTitle} s={s} />
        <Bone style={s.lineSub} s={s} />
      </View>
    </View>
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  const T = useColors();
  const s = makeStyles(T);
  return (
    <View style={s.card}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i}>
          <SkeletonRow s={s} />
          {i < rows - 1 && <View style={s.divider} />}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (T: ReturnType<typeof useColors>) => StyleSheet.create({
  bone: { backgroundColor: T.border, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: 10 },
  lines: { flex: 1, gap: 6 },
  lineTitle: { height: 14, width: '60%' },
  lineSub: { height: 11, width: '40%' },
  card: { backgroundColor: T.surface, borderRadius: 16, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: T.border, marginLeft: 64 },
});

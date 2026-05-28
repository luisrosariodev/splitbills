import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT, T } from '../lib/theme';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

const SIZES = {
  sm: { stripe: { width: 26, height: 5.5 }, gap: 6, iconW: 34, wordmark: 15, gap2: 7, radius: 3 },
  md: { stripe: { width: 36, height: 7.5 }, gap: 8, iconW: 46, wordmark: 20, gap2: 10, radius: 4 },
  lg: { stripe: { width: 52, height: 10 }, gap: 11, iconW: 64, wordmark: 28, gap2: 13, radius: 5 },
};

export default function DivviLogo({ size = 'md', showWordmark = true }: Props) {
  const d = SIZES[size];

  return (
    <View style={styles.row}>
      {/* Two-stripe icon */}
      <View style={[styles.iconWrap, { width: d.iconW }]}>
        <View style={[styles.stripes, { gap: d.gap }]}>
          <LinearGradient
            colors={GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.stripe, { width: d.stripe.width, height: d.stripe.height, borderRadius: d.radius }]}
          />
          <LinearGradient
            colors={GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.stripe, { width: d.stripe.width, height: d.stripe.height, borderRadius: d.radius }]}
          />
        </View>
      </View>

      {/* Wordmark */}
      {showWordmark && (
        <Text style={[styles.wordmark, { fontSize: d.wordmark, marginLeft: d.gap2 - 4 }]}>
          divvi
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  stripes: {
    transform: [{ rotate: '-22deg' }],
    alignItems: 'flex-start',
  },
  stripe: {},
  wordmark: {
    fontWeight: '800',
    color: T.accent,
    letterSpacing: -0.6,
  },
});

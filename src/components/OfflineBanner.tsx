import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../lib/theme';

const HIDE_Y = -150;

export default function OfflineBanner() {
  const T = useColors();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const translateY = useRef(new Animated.Value(HIDE_Y)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: offline ? 0 : HIDE_Y,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }, [offline]);

  return (
    <Animated.View style={[styles.banner, { backgroundColor: T.warning, paddingTop: insets.top + 6, transform: [{ translateY }] }]}>
      <Text style={styles.text}>Sin conexión — los divvis se sincronizarán al reconectar</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 99,
    paddingBottom: 8, paddingHorizontal: 16,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});

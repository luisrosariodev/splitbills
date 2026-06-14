import { useEffect, useState, useRef } from 'react';
import { View, AppState, Text, Pressable, StyleSheet, LogBox, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

LogBox.ignoreLogs([
  'AuthRetryableFetchError',
  'AuthSessionMissingError',
  'AuthInvalidCredentialsError',
]);
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import supabaseClient from './src/lib/supabase';
import { RootStackParamList, TabParamList } from './src/types/navigation';
import { syncOfflineQueue } from './src/lib/splitService';
import { getBiometricEnabled } from './src/lib/settings';
import { requestNotificationPermission } from './src/lib/notifications';
import { useColors, FONTS } from './src/lib/theme';
import OfflineBanner from './src/components/OfflineBanner';

import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import CreateSplitScreen from './src/screens/CreateSplitScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SplitDetailScreen from './src/screens/SplitDetailScreen';
import GroupDetailScreen from './src/screens/GroupDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import EditSplitScreen from './src/screens/EditSplitScreen';
import SettlementsScreen from './src/screens/SettlementsScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import StatsScreen from './src/screens/StatsScreen';
import OnboardingScreen, { ONBOARDING_KEY } from './src/screens/OnboardingScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function BiometricGate({ onUnlock }: { onUnlock: () => void }) {
  const [failed, setFailed] = useState(false);
  const T = useColors();
  const gate = makeGateStyles(T);

  const authenticate = async () => {
    setFailed(false);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Accede a divvi',
        fallbackLabel: 'Usar contraseña',
        cancelLabel: 'Cancelar',
      });
      if (result.success) onUnlock();
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => { authenticate(); }, []);

  return (
    <View style={gate.container}>
      <View style={gate.lockIcon} />
      <Text style={gate.title}>divvi</Text>
      <Text style={gate.sub}>Autenticación requerida</Text>
      {failed && (
        <View style={gate.actions}>
          <Pressable style={gate.retryBtn} onPress={authenticate}>
            <Text style={gate.retryText}>Reintentar Face ID</Text>
          </Pressable>
          <Pressable onPress={() => supabaseClient.auth.signOut()}>
            <Text style={gate.signOutText}>Cerrar sesión</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeGateStyles = (T: ReturnType<typeof useColors>) => StyleSheet.create({
  container: {
    flex: 1, backgroundColor: T.bg,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  lockIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: T.accentDim, borderWidth: 2, borderColor: T.accent,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: T.text, letterSpacing: -0.8 },
  sub: { fontSize: 15, color: T.textSec, marginBottom: 16 },
  actions: { alignItems: 'center', gap: 16, marginTop: 8 },
  retryBtn: {
    backgroundColor: T.accent, paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 14,
  },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  signOutText: { fontSize: 14, color: T.textDim },
});

type TabName = 'Home' | 'History' | 'Stats' | 'Profile';

const TAB_CONFIG: Record<TabName, {
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
  label: string;
}> = {
  Home:    { icon: 'home',        iconOutline: 'home-outline',        label: 'Inicio'   },
  History: { icon: 'time',        iconOutline: 'time-outline',        label: 'Historial' },
  Stats:   { icon: 'stats-chart', iconOutline: 'stats-chart-outline', label: 'Stats'    },
  Profile: { icon: 'person',      iconOutline: 'person-outline',      label: 'Perfil'   },
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const T = useColors();
  const tb = makeTbStyles(T);

  return (
    <View style={[tb.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={tb.container}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIG[route.name as TabName];
          if (!config) return null;

          const onPress = () => {
            if (!isFocused) {
              Haptics.selectionAsync();
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={tb.tab}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={config.label}
            >
              {isFocused ? (
                <View style={tb.pill}>
                  <Ionicons name={config.icon} size={18} color="#FAFAFA" />
                  <Text style={tb.pillLabel}>{config.label}</Text>
                </View>
              ) : (
                <Ionicons name={config.iconOutline} size={22} color={T.textDim} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeTbStyles = (T: ReturnType<typeof useColors>) => StyleSheet.create({
  wrapper: {
    backgroundColor: T.bg,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: T.surface,
    borderRadius: 26,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#160C2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: T.accent,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  pillLabel: {
    color: '#FAFAFA',
    fontSize: 13,
    fontFamily: FONTS.bold,
    letterSpacing: -0.2,
  },
});

function MainTabs() {
  const T = useColors();
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: T.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' as const, color: T.text, fontSize: 17, letterSpacing: -0.2 },
        headerTintColor: T.accent,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Inicio', headerShown: false }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Historial' }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ title: 'Stats' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['divvi://'],
  config: {
    screens: {
      MainTabs: {
        screens: { Home: '', History: 'history', Profile: 'profile' },
      },
      SplitDetail: 'split/:splitId',
    },
  },
};

export default function App() {
  const T = useColors();
  const colorScheme = useColorScheme();
  const stackOptions = {
    headerStyle: { backgroundColor: T.surface },
    headerShadowVisible: false,
    headerTitleStyle: { fontWeight: '700' as const, color: T.text, fontSize: 17, letterSpacing: -0.2 },
    headerTintColor: T.accent,
    contentStyle: { backgroundColor: T.bg },
  };

  const [fontsLoaded] = useFonts({
    [FONTS.regular]: require('./assets/fonts/Sansation-Regular.ttf'),
    [FONTS.bold]:    require('./assets/fonts/Sansation-Bold.ttf'),
  });

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [{ data: { session: s } }, done, bioEnabled] = await Promise.all([
          supabaseClient.auth.getSession(),
          AsyncStorage.getItem(ONBOARDING_KEY),
          getBiometricEnabled(),
          requestNotificationPermission(),
        ]);
        setSession(s);
        setOnboarded(done === '1');
        setBiometricEnabledState(bioEnabled);
      } catch {
        // Network unavailable on startup — keep loading=false so app renders
        setOnboarded(true);
      } finally {
        setLoading(false);
      }
    };
    init();
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    if (!session) return;
    syncOfflineQueue().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active') {
        if (sessionRef.current) syncOfflineQueue().catch(() => {});
        getBiometricEnabled().then((enabled) => {
          if (enabled && backgroundedAt.current && Date.now() - backgroundedAt.current > 30_000) {
            setUnlocked(false);
          }
          backgroundedAt.current = null;
        });
      }
    });
    return () => sub.remove();
  }, [session]);

  if (loading || onboarded === null || !fontsLoaded) return <View style={{ flex: 1, backgroundColor: T.bg }} />;

  if (!onboarded) {
    return (
      <>
        <StatusBar style="dark" />
        <OnboardingScreen onDone={() => setOnboarded(true)} />
      </>
    );
  }

  if (session && biometricEnabled && !unlocked) {
    return (
      <>
        <StatusBar style="dark" />
        <BiometricGate onUnlock={() => setUnlocked(true)} />
      </>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <OfflineBanner />
      <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme} linking={linking}>
        <Stack.Navigator screenOptions={stackOptions}>
          {session ? (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
              <Stack.Screen name="CreateSplit" component={CreateSplitScreen} options={{ title: 'Nuevo divvi' }} />
              <Stack.Screen name="SplitDetail" component={SplitDetailScreen}
                options={({ route }) => ({ title: route.params.splitName ?? '' })} />
              <Stack.Screen name="GroupDetail" component={GroupDetailScreen}
                options={({ route }) => ({ title: route.params.groupName })} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configuración' }} />
              <Stack.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Contactos' }} />
              <Stack.Screen name="EditSplit" component={EditSplitScreen}
                options={({ route }) => ({ title: route.params.splitName })} />
              <Stack.Screen name="Settlements" component={SettlementsScreen}
                options={{ title: 'Pagos' }} />
            </>
          ) : (
            <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

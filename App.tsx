import { useEffect, useState, useRef } from 'react';
import { View, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import supabaseClient from './src/lib/supabase';
import { RootStackParamList } from './src/types/navigation';
import { syncOfflineQueue } from './src/lib/splitService';
import { T } from './src/lib/theme';

import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import CreateSplitScreen from './src/screens/CreateSplitScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SplitDetailScreen from './src/screens/SplitDetailScreen';
import GroupDetailScreen from './src/screens/GroupDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import EditSplitScreen from './src/screens/EditSplitScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['splitbills://'],
  config: {
    screens: {
      Home: '',
      SplitDetail: 'split/:splitId',
      History: 'history',
      Profile: 'profile',
    },
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: T.surface },
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: '700' as const, color: T.text, fontSize: 17, letterSpacing: -0.2 },
  headerTintColor: T.accent,
  contentStyle: { backgroundColor: T.bg },
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    if (!session) return;
    syncOfflineQueue().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && sessionRef.current) syncOfflineQueue().catch(() => {});
    });
    return () => sub.remove();
  }, [session]);

  if (loading) return <View style={{ flex: 1, backgroundColor: T.bg }} />;

  return (
    <>
      <StatusBar style="dark" />
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={screenOptions}>
          {session ? (
            <>
              <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
              <Stack.Screen name="CreateSplit" component={CreateSplitScreen} options={{ title: 'Nuevo Split' }} />
              <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Historial' }} />
              <Stack.Screen name="SplitDetail" component={SplitDetailScreen}
                options={({ route }) => ({ title: route.params.splitName })} />
              <Stack.Screen name="GroupDetail" component={GroupDetailScreen}
                options={({ route }) => ({ title: route.params.groupName })} />
              <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configuración' }} />
              <Stack.Screen name="EditSplit" component={EditSplitScreen}
                options={({ route }) => ({ title: route.params.splitName })} />
            </>
          ) : (
            <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

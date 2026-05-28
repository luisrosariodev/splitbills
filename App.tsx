import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import supabaseClient from './src/lib/supabase';
import { RootStackParamList } from './src/types/navigation';

import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import CreateSplitScreen from './src/screens/CreateSplitScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SplitDetailScreen from './src/screens/SplitDetailScreen';
import GroupDetailScreen from './src/screens/GroupDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: '#F2F2F7' },
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: '700' as const, color: '#1C1C1E', fontSize: 17 },
  headerTintColor: '#007AFF',
  contentStyle: { backgroundColor: '#F2F2F7' },
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <View style={{ flex: 1, backgroundColor: '#F2F2F7' }} />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {session ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'SplitBills' }} />
            <Stack.Screen name="CreateSplit" component={CreateSplitScreen} options={{ title: 'Nuevo Split' }} />
            <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Historial' }} />
            <Stack.Screen name="SplitDetail" component={SplitDetailScreen}
              options={({ route }) => ({ title: route.params.splitName })} />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen}
              options={({ route }) => ({ title: route.params.groupName })} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

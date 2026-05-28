import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') return true;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  return newStatus === 'granted';
};

export const notifySplitSaved = async (splitName: string): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Split guardado',
        body: `"${splitName}" guardado en tu historial.`,
      },
      trigger: null,
    });
  } catch {
    // Non-critical — never throw
  }
};

export const notifyQueueSynced = async (count: number): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Sincronización completa',
        body: `${count} split${count > 1 ? 's sincronizados' : ' sincronizado'}.`,
      },
      trigger: null,
    });
  } catch {}
};

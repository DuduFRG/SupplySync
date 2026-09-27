import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { request } from '@/api/client';

let currentToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushResult = 'granted' | 'denied' | 'unavailable';

/**
 * Pede permissão e registra o aparelho para receber avisos de itens essenciais.
 * Chamado apenas depois que a pessoa entende o porquê (nunca no primeiro segundo do app).
 */
export async function registerForPush(): Promise<PushResult> {
  if (!Device.isDevice) return 'unavailable';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('supplies', {
      name: 'Itens da casa',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const final = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!final.granted) return 'denied';

  const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
  if (!projectId) return 'unavailable';

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  currentToken = data;
  await request('/v1/me/push-tokens', {
    method: 'POST',
    body: { token: data, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
  });
  return 'granted';
}

export async function unregisterPushToken(): Promise<void> {
  if (!currentToken) return;
  await request('/v1/me/push-tokens', { method: 'DELETE', body: { token: currentToken } });
  currentToken = null;
}

export async function getPushPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

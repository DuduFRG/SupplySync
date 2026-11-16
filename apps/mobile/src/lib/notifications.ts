import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsModule from 'expo-notifications';
import { request } from '@/api/client';

/**
 * No Expo Go (o app de testes) os avisos push não funcionam no Android, e só carregar
 * o módulo já mostra um erro vermelho. Por isso ele só é carregado fora do Expo Go.
 * Na versão instalada de verdade (EAS Build), tudo funciona normalmente.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const Notifications: typeof NotificationsModule | null = isExpoGo
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-notifications') as typeof NotificationsModule);

const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;

/** Motivo pelo qual os avisos não estão disponíveis, ou null se estão. */
export type PushUnavailableReason = 'expo-go' | 'simulator' | 'not-configured' | 'web';

export function pushUnavailableReason(): PushUnavailableReason | null {
  if (Platform.OS === 'web') return 'web';
  if (isExpoGo) return 'expo-go';
  if (!Device.isDevice) return 'simulator';
  if (!projectId) return 'not-configured';
  return null;
}

export const PUSH_UNAVAILABLE_TEXT: Record<PushUnavailableReason, string> = {
  'expo-go': 'Os avisos funcionam na versão instalada do app. No Expo Go, que é só para testes, eles ficam desligados.',
  simulator: 'Os avisos só funcionam em um celular de verdade.',
  'not-configured': 'Os avisos ainda não foram configurados nesta versão do app.',
  web: 'Os avisos não funcionam no navegador.',
};

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let currentToken: string | null = null;

export type PushResult = 'granted' | 'denied' | 'unavailable';

/**
 * Pede permissão e registra o aparelho para receber avisos de itens essenciais.
 * Chamado apenas depois que a pessoa entende o porquê (nunca no primeiro segundo do app).
 */
export async function registerForPush(): Promise<PushResult> {
  if (!Notifications || pushUnavailableReason()) return 'unavailable';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('supplies', {
      name: 'Itens da casa',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const final = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!final.granted) return 'denied';

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
  if (!Notifications || pushUnavailableReason()) return false;
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/** Toque em um aviso abre o item correspondente. Devolve a função que cancela a escuta. */
export function onNotificationTap(openItem: (itemId: string) => void): () => void {
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { itemId?: unknown };
    if (typeof data.itemId === 'string' && /^[0-9a-f-]{36}$/i.test(data.itemId)) openItem(data.itemId);
  });
  return () => sub.remove();
}

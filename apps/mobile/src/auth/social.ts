import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type * as GoogleSigninModule from '@react-native-google-signin/google-signin';
import type { SocialProvider } from '@supplysync/shared';
import { isExpoGo } from '@/lib/notifications';

/**
 * Login com Apple e Google no aparelho.
 *
 * O app só obtém o "token de identidade" do provedor. Quem decide se a pessoa entra
 * é a API, que confere a assinatura do token com as chaves do Google/Apple.
 */

export interface SocialCredential {
  provider: SocialProvider;
  idToken: string;
  nonce?: string;
  displayName?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const GOOGLE_WEB_CLIENT_ID = str(extra.googleWebClientId);
const GOOGLE_IOS_CLIENT_ID = str(extra.googleIosClientId);

/**
 * O Google precisa de código nativo que o Expo Go não tem. Por isso o módulo só é
 * carregado na versão instalada do app, e o botão não aparece no Expo Go.
 */
const Google: typeof GoogleSigninModule | null =
  !isExpoGo && Platform.OS !== 'web' && GOOGLE_WEB_CLIENT_ID
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('@react-native-google-signin/google-signin') as typeof GoogleSigninModule)
    : null;

Google?.GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID ?? undefined,
  iosClientId: GOOGLE_IOS_CLIENT_ID ?? undefined,
  scopes: ['email', 'profile'],
});

export const googleAvailable = Google !== null;

export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** A pessoa fechou a janela de login: não é erro, só não faz nada. */
export class SocialCancelled extends Error {}

export async function signInWithApple(): Promise<SocialCredential> {
  // Valor aleatório: a Apple recebe o hash e a API recebe o original para conferir.
  const rawNonce = Crypto.randomUUID().replace(/-/g, '') + Crypto.randomUUID().replace(/-/g, '');
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new SocialCancelled();
    throw err;
  }
  if (!credential.identityToken) throw new Error('A Apple não devolveu o login');

  // A Apple só envia o nome na primeira vez que a pessoa entra no app.
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ').trim();
  return { provider: 'apple', idToken: credential.identityToken, nonce: rawNonce, displayName: name || undefined };
}

export async function signInWithGoogle(): Promise<SocialCredential> {
  if (!Google) throw new Error('Login com Google indisponível nesta versão do app');
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = Google;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Sempre pergunta a conta: evita entrar sem querer com a conta errada do aparelho.
    await GoogleSignin.signOut().catch(() => undefined);
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new SocialCancelled();
    const idToken = response.data.idToken;
    if (!idToken) throw new Error('O Google não devolveu o login');
    return { provider: 'google', idToken };
  } catch (err) {
    if (err instanceof SocialCancelled) throw err;
    if (isErrorWithCode(err) && (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS)) {
      throw new SocialCancelled();
    }
    throw err;
  }
}

export function signInWith(provider: SocialProvider): Promise<SocialCredential> {
  return provider === 'apple' ? signInWithApple() : signInWithGoogle();
}

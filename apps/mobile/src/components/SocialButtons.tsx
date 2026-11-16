import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { SocialProvider } from '@supplysync/shared';
import { authApi } from '@/api/hooks';
import { useSession } from '@/auth/AuthProvider';
import { appleAvailable, googleAvailable, signInWith, SocialCancelled } from '@/auth/social';
import { apiErrorToForm } from '@/lib/forms';
import { isExpoGo } from '@/lib/notifications';
import { colors, radius, space } from '@/theme';
import { Banner, PressableScale, Text } from './ui';

/**
 * Botões "Continuar com Apple" e "Continuar com Google".
 * Servem para entrar e para criar conta: se a pessoa ainda não tem conta, ela é criada na hora.
 */
export function SocialButtons({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { signIn } = useSession();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void appleAvailable().then(setApple);
  }, []);

  async function start(provider: SocialProvider) {
    setError(null);
    setBusy(provider);
    try {
      const credential = await signInWith(provider);
      await signIn(await authApi.social(credential));
      router.replace('/');
    } catch (err) {
      if (!(err instanceof SocialCancelled)) setError(apiErrorToForm(err).message);
    } finally {
      setBusy(null);
    }
  }

  if (!apple && !googleAvailable) {
    // No Expo Go do Android não há nenhum dos dois: só explicamos, em modo de teste.
    return __DEV__ && isExpoGo ? (
      <Text variant="caption" color={colors.textSecondary} align="center">
        Os botões de entrar com Google e Apple aparecem na versão instalada do app.
      </Text>
    ) : null;
  }

  return (
    <View style={styles.wrap}>
      {error ? <Banner>{error}</Banner> : null}

      {apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            mode === 'sign-up'
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
          }
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.md}
          style={[styles.apple, busy && styles.busy]}
          onPress={() => void (busy ? undefined : start('apple'))}
        />
      ) : null}

      {googleAvailable ? (
        <PressableScale
          onPress={() => void (busy ? undefined : start('google'))}
          accessibilityLabel="Continuar com Google"
          accessibilityState={{ busy: busy === 'google' }}
          style={[styles.google, busy && styles.busy]}
        >
          <MaterialCommunityIcons name="google" size={20} color="#4285F4" />
          <Text variant="bodyStrong">{busy === 'google' ? 'Conectando...' : 'Continuar com Google'}</Text>
        </PressableScale>
      ) : null}

      {!googleAvailable && isExpoGo && __DEV__ ? (
        <Text variant="caption" color={colors.textSecondary} align="center">
          O botão do Google aparece na versão instalada do app.
        </Text>
      ) : null}

      {mode === 'sign-in' ? (
        // Entrar com Google/Apple pela primeira vez cria a conta: o aceite precisa aparecer aqui também.
        <Text variant="caption" color={colors.textSecondary} align="center">
          Se for sua primeira vez, você confirma ter 18 anos ou mais e concorda com os{' '}
          <Text
            variant="caption"
            color={colors.primary}
            style={styles.link}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'termos' } })}
          >
            Termos
          </Text>{' '}
          e a{' '}
          <Text
            variant="caption"
            color={colors.primary}
            style={styles.link}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacidade' } })}
          >
            Política de Privacidade
          </Text>
          .
        </Text>
      ) : null}

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text variant="caption" color={colors.textSecondary}>
          {mode === 'sign-up' ? 'ou crie com e-mail' : 'ou entre com e-mail'}
        </Text>
        <View style={styles.line} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  apple: { height: 54, width: '100%' },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  busy: { opacity: 0.6 },
  link: { textDecorationLine: 'underline' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});

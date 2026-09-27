import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { emailSchema } from '@supplysync/shared';
import { authApi } from '@/api/hooks';
import { useSession } from '@/auth/AuthProvider';
import { CodeInput } from '@/components/CodeInput';
import { HumanCheck, humanCheckEnabled } from '@/components/HumanCheck';
import { Banner, Button, Screen, Text } from '@/components/ui';
import { apiErrorToForm } from '@/lib/forms';
import { colors } from '@/theme';

export default function Verify() {
  const params = useLocalSearchParams<{ email?: string }>();
  const parsedEmail = emailSchema.safeParse(params.email ?? '');
  const email = parsedEmail.success ? parsedEmail.data : null;

  const { signIn } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [captchaKey, setCaptchaKey] = useState(0);
  const onToken = useCallback((t: string | undefined) => setCaptchaToken(t), []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (!email) router.replace('/sign-up');
  }, [email]);

  async function submit(value = code) {
    if (!email || value.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      await signIn(await authApi.verifyEmail({ email, code: value }));
      router.replace('/');
    } catch (err) {
      setError(apiErrorToForm(err).message);
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!email) return;
    setError(null);
    try {
      const res = await authApi.resendCode({ email, captchaToken });
      setInfo(res.message);
      setCooldown(60);
    } catch (err) {
      setError(apiErrorToForm(err).message);
    } finally {
      setCaptchaKey((k) => k + 1);
    }
  }

  return (
    <Screen
      back
      title="Confirme seu e-mail"
      subtitle={email ? `Enviamos um código de 6 dígitos para ${email}. Ele vale por 15 minutos.` : undefined}
      footer={<Button label="Confirmar" onPress={() => void submit()} loading={loading} disabled={code.length !== 6} />}
    >
      {error ? <Banner>{error}</Banner> : null}
      {info ? <Banner tone="info">{info}</Banner> : null}
      <CodeInput
        value={code}
        error={!!error}
        onChange={(v) => {
          setCode(v);
          if (v.length === 6) void submit(v);
        }}
      />
      <Text variant="caption" color={colors.textSecondary}>
        Não chegou? Confira a caixa de spam. Por segurança, não informamos se o e-mail já tem cadastro.
      </Text>
      {cooldown <= 0 ? <HumanCheck onToken={onToken} resetKey={captchaKey} /> : null}
      <Button
        label={cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'}
        variant="secondary"
        disabled={cooldown > 0 || (humanCheckEnabled && !captchaToken)}
        onPress={() => void resend()}
      />
    </Screen>
  );
}

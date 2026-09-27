import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { emailOnlySchema, resetPasswordSchema } from '@supplysync/shared';
import { authApi } from '@/api/hooks';
import { useSession } from '@/auth/AuthProvider';
import { CodeInput } from '@/components/CodeInput';
import { HumanCheck, humanCheckEnabled } from '@/components/HumanCheck';
import { Banner, Button, Screen, TextField } from '@/components/ui';
import { apiErrorToForm, validate, type FieldErrors } from '@/lib/forms';

export default function Forgot() {
  const { signIn } = useSession();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [captchaKey, setCaptchaKey] = useState(0);
  const onToken = useCallback((t: string | undefined) => setCaptchaToken(t), []);

  async function requestCode() {
    setMessage(null);
    const v = validate(emailOnlySchema, { email, captchaToken });
    if ('errors' in v) return setErrors(v.errors);
    setErrors({});
    setLoading(true);
    try {
      await authApi.forgotPassword(v.data);
      setEmail(v.data.email);
      setStep('reset');
    } catch (err) {
      setMessage(apiErrorToForm(err).message);
      setCaptchaKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    setMessage(null);
    const v = validate(resetPasswordSchema, { email, code, newPassword });
    if ('errors' in v) return setErrors(v.errors);
    setErrors({});
    setLoading(true);
    try {
      await signIn(await authApi.resetPassword(v.data));
      router.replace('/');
    } catch (err) {
      const e = apiErrorToForm(err);
      setMessage(e.message);
      setErrors(e.fields);
    } finally {
      setLoading(false);
    }
  }

  if (step === 'email') {
    return (
      <Screen
        back
        title="Redefinir senha"
        subtitle="Informe seu e-mail. Se houver uma conta, enviaremos um código."
        footer={<Button label="Enviar código" onPress={() => void requestCode()} loading={loading} disabled={humanCheckEnabled && !captchaToken} />}
      >
        {message ? <Banner>{message}</Banner> : null}
        <TextField
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <HumanCheck onToken={onToken} resetKey={captchaKey} />
      </Screen>
    );
  }

  return (
    <Screen
      back
      title="Crie uma nova senha"
      subtitle={`Digite o código enviado para ${email} e escolha a nova senha. Todas as sessões abertas serão encerradas.`}
      footer={<Button label="Salvar nova senha" onPress={() => void reset()} loading={loading} />}
    >
      {message ? <Banner>{message}</Banner> : null}
      <CodeInput value={code} onChange={setCode} error={!!errors.code} />
      <TextField
        label="Nova senha"
        value={newPassword}
        onChangeText={setNewPassword}
        error={errors.newPassword}
        secureTextEntry
        secureToggle
        autoComplete="new-password"
        textContentType="newPassword"
        hint="Ao menos 10 caracteres, com letras e números."
      />
    </Screen>
  );
}

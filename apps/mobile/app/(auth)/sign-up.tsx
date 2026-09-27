import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { Link, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { registerSchema } from '@supplysync/shared';
import { authApi } from '@/api/hooks';
import { HumanCheck, humanCheckEnabled } from '@/components/HumanCheck';
import { Banner, Button, Screen, Text, TextField } from '@/components/ui';
import { apiErrorToForm, validate, type FieldErrors } from '@/lib/forms';
import { colors, space } from '@/theme';

function PasswordRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.rule}>
      <Feather name={ok ? 'check-circle' : 'circle'} size={14} color={ok ? colors.primary : colors.icon} />
      <Text variant="caption" color={ok ? colors.primaryPressed : colors.textSecondary}>
        {label}
      </Text>
    </View>
  );
}

export default function SignUp() {
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [captchaKey, setCaptchaKey] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const onToken = useCallback((t: string | undefined) => setCaptchaToken(t), []);

  async function submit() {
    setMessage(null);
    const v = validate(registerSchema, { email, password, displayName, captchaToken });
    if ('errors' in v) return setErrors(v.errors);
    setErrors({});
    setLoading(true);
    try {
      await authApi.register(v.data);
      router.push({ pathname: '/verify', params: { email: v.data.email } });
    } catch (err) {
      const e = apiErrorToForm(err);
      setMessage(e.message);
      setErrors(e.fields);
      setCaptchaKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      title="Crie sua conta"
      subtitle="Você vai usar a mesma conta em todos os seus aparelhos."
      footer={
        <>
          <Button label="Criar conta" onPress={() => void submit()} loading={loading} disabled={humanCheckEnabled && !captchaToken} />
          <Link href="/sign-in" replace asChild>
            <Button label="Já tenho conta" variant="ghost" />
          </Link>
        </>
      }
    >
      {message ? <Banner>{message}</Banner> : null}
      <TextField
        label="Como a casa te chama?"
        value={displayName}
        onChangeText={setDisplayName}
        error={errors.displayName}
        autoComplete="name"
        textContentType="nickname"
        maxLength={40}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Senha"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        secureToggle
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={128}
      />
      <View style={styles.rules}>
        <PasswordRule ok={password.length >= 10} label="Ao menos 10 caracteres" />
        <PasswordRule ok={/[A-Za-zÀ-ÿ]/.test(password) && /\d/.test(password)} label="Letras e números" />
      </View>
      <HumanCheck onToken={onToken} resetKey={captchaKey} />
      <Text variant="caption" color={colors.textSecondary}>
        Ao criar a conta você concorda com os Termos de Uso e a Política de Privacidade. Seus dados são usados apenas para o funcionamento da sua casa no app.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rules: { gap: space.xs, marginTop: -space.sm },
  rule: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

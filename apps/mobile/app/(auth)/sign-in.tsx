import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { Link, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loginSchema } from '@supplysync/shared';
import { authApi } from '@/api/hooks';
import { ApiError } from '@/api/client';
import { useSession } from '@/auth/AuthProvider';
import { HumanCheck, humanCheckEnabled } from '@/components/HumanCheck';
import { Banner, Button, Screen, Text, TextField } from '@/components/ui';
import { apiErrorToForm, validate, type FieldErrors } from '@/lib/forms';
import { colors, space } from '@/theme';

export default function SignIn() {
  const { signIn } = useSession();
  const passwordRef = useRef<TextInput>(null);
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
    const v = validate(loginSchema, { email, password, captchaToken });
    if ('errors' in v) return setErrors(v.errors);
    setErrors({});
    setLoading(true);
    try {
      await signIn(await authApi.login(v.data));
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        router.push({ pathname: '/verify', params: { email: v.data.email } });
        return;
      }
      const e = apiErrorToForm(err);
      setMessage(e.message);
      setErrors(e.fields);
      setCaptchaKey((k) => k + 1); // tokens antibot são de uso único
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button label="Entrar" onPress={() => void submit()} loading={loading} disabled={humanCheckEnabled && !captchaToken} />
          <Link href="/sign-up" replace asChild>
            <Button label="Ainda não tenho conta" variant="ghost" />
          </Link>
        </>
      }
    >
      <View style={styles.brand}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="sync" size={26} color={colors.textInverse} />
        </View>
        <Text variant="display" accessibilityRole="header">
          Bem-vindo de volta
        </Text>
        <Text color={colors.textSecondary}>Entre para ver o que está acabando na sua casa.</Text>
      </View>

      {message ? <Banner>{message}</Banner> : null}

      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
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
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <Link href="/forgot" asChild>
        <Button label="Esqueci minha senha" variant="ghost" size="md" full={false} style={styles.forgot} />
      </Link>
      <HumanCheck onToken={onToken} resetKey={captchaKey} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { gap: space.sm, marginTop: space.xl, marginBottom: space.md },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  forgot: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});

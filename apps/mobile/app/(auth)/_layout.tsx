import { Redirect, Stack } from 'expo-router';
import { useSession } from '@/auth/AuthProvider';
import { colors } from '@/theme';

export default function AuthLayout() {
  const { status, onboarding } = useSession();
  if (!onboarding) return <Redirect href="/onboarding" />;
  if (status === 'signedIn') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}

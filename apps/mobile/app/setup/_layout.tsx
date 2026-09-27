import { Redirect, Stack } from 'expo-router';
import { useSession } from '@/auth/AuthProvider';
import { colors } from '@/theme';

export default function SetupLayout() {
  const { status } = useSession();
  if (status !== 'signedIn') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}

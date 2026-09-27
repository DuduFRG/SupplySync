import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View, type ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMe } from '@/api/hooks';
import { useSession } from '@/auth/AuthProvider';
import { Banner, Button } from '@/components/ui';
import { colors, fonts, space } from '@/theme';

const icon =
  (name: ComponentProps<typeof Feather>['name']) =>
  ({ color }: { color: ColorValue }) => <Feather name={name} size={22} color={color as string} />;

/**
 * Porta de entrada do app ("/"). A ordem é intencional:
 * 1. Onboarding completo (consciência do problema antes de qualquer cadastro)
 * 2. Conta
 * 3. Casa
 * 4. App
 */
export default function TabsLayout() {
  const { status, onboarding } = useSession();
  const me = useMe();

  if (!onboarding) return <Redirect href="/onboarding" />;
  if (status !== 'signedIn') return <Redirect href="/sign-in" />;

  if (me.isError) {
    return (
      <View style={styles.center}>
        <Banner>Não foi possível carregar seus dados.</Banner>
        <Button label="Tentar de novo" onPress={() => void me.refetch()} />
      </View>
    );
  }
  if (!me.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (me.data.households.length === 0) return <Redirect href="/setup" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Casa', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="shopping" options={{ title: 'Compras', tabBarIcon: icon('shopping-bag') }} />
      <Tabs.Screen name="split" options={{ title: 'Contas', tabBarIcon: icon('pie-chart') }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl, backgroundColor: colors.background },
});

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { colors, radius, shadow, space } from '@/theme';
import { Text } from './ui';

/**
 * Faixa discreta no topo quando o celular fica sem internet. Sem ela, as ações
 * falhariam sem a pessoa entender o motivo. Some sozinha quando a conexão volta.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { isConnected, isInternetReachable } = useNetInfo();
  // null significa "ainda não sabemos": só avisamos quando há certeza de que está offline.
  const offline = isConnected === false || isInternetReachable === false;

  if (!offline) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(250)}
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + space.xs }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View style={styles.pill}>
        <Feather name="wifi-off" size={16} color={colors.textInverse} />
        <Text variant="label" color={colors.textInverse}>
          Sem internet. Nada será salvo agora.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    ...shadow.raised,
  },
});

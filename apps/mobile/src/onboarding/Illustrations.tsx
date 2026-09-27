import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { STARTER_ICONS } from '@/lib/categories';
import { Text } from '@/components/ui';
import { colors, palette, radius, shadow, space } from '@/theme';

const SHELF = ['toilet-paper', 'dish-soap', 'water-filter', 'coffee', 'pet-food', 'soap'] as const;

function ShelfTile({ icon, empty }: { icon: string; empty: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(empty ? 1 : 0, { duration: 500 });
  }, [empty, progress]);

  const tileStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * 0.55,
    transform: [{ scale: 1 - progress.value * 0.06 }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.6 + progress.value * 0.4 }],
  }));

  return (
    <View style={styles.tileWrap}>
      <Animated.View style={[styles.tile, empty && styles.tileEmpty, tileStyle]}>
        <MaterialCommunityIcons name={STARTER_ICONS[icon] ?? 'package-variant'} size={30} color={palette.green700} />
      </Animated.View>
      <Animated.View style={[styles.badge, badgeStyle]}>
        <Text variant="label" color={colors.textInverse}>
          ?
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * Capítulo 1: uma prateleira que vai se esvaziando sozinha, sem ninguém perceber.
 * Metáfora visual do consumo invisível.
 */
export function EmptyingShelf() {
  const [emptied, setEmptied] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setEmptied((n) => (n >= SHELF.length + 2 ? 0 : n + 1)), 900);
    return () => clearInterval(id);
  }, []);

  // Ordem "aleatória" fixa para parecer orgânico.
  const order = [2, 0, 4, 1, 5, 3];

  return (
    <View style={styles.shelfCard} accessible accessibilityLabel="Ilustração: itens da casa acabando um a um">
      <View style={styles.grid}>
        {SHELF.map((key, i) => (
          <ShelfTile key={key} icon={key} empty={order.indexOf(i) < emptied} />
        ))}
      </View>
      <View style={styles.shelfBoard} />
    </View>
  );
}

/** Capítulo 5: indicador animado de "de quem é a vez". */
export function RotationRing({ names, current }: { names: string[]; current: number }) {
  return (
    <View style={styles.rotation}>
      {names.map((name, i) => (
        <RotationAvatar key={name} name={name} active={i === current} />
      ))}
    </View>
  );
}

function RotationAvatar({ name, active }: { name: string; active: boolean }) {
  const s = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    s.value = withSpring(active ? 1 : 0, { damping: 14, stiffness: 180 });
  }, [active, s]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.86 + s.value * 0.22 }, { translateY: -s.value * 6 }],
    borderColor: active ? palette.green600 : 'transparent',
  }));

  return (
    <View style={styles.rotationItem}>
      <Animated.View style={[styles.rotationAvatar, style]}>
        <View style={[styles.rotationInner, { backgroundColor: active ? palette.green600 : palette.ink200 }]}>
          <Text variant="headline" color={active ? colors.textInverse : colors.textSecondary}>
            {name[0]}
          </Text>
        </View>
      </Animated.View>
      <Text variant="label" color={active ? colors.text : colors.textSecondary}>
        {name}
      </Text>
      <View style={[styles.turnTag, { opacity: active ? 1 : 0 }]}>
        <Text variant="overline" color={palette.green700} style={styles.turnText}>
          da vez
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shelfCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.xl,
    paddingBottom: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.lg },
  tileWrap: { width: '30%', aspectRatio: 1 },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: palette.green50,
    borderWidth: 1.5,
    borderColor: palette.green100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileEmpty: { backgroundColor: colors.surface, borderStyle: 'dashed', borderColor: palette.ink200 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.red700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelfBoard: { height: 6, borderRadius: 3, backgroundColor: palette.ink100, marginTop: space.lg },
  rotation: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: space.lg },
  rotationItem: { alignItems: 'center', gap: space.sm },
  rotationAvatar: { borderWidth: 3, borderRadius: 40, padding: 3 },
  rotationInner: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  turnTag: { backgroundColor: palette.green100, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  turnText: { fontSize: 10 },
});

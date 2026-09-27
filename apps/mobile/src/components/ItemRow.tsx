import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { ItemDTO } from '@supplysync/shared';
import { relativeTime } from '@/lib/format';
import { colors, radius, space, statusColors } from '@/theme';
import { CategoryIcon, PressableScale, Text } from './ui';

interface ItemRowProps {
  item: ItemDTO;
  buyerName: string;
  isMyTurn: boolean;
  onQuickAction: (item: ItemDTO) => void;
}

/** Ação contextual de um toque: o próximo passo natural para o estado atual do item. */
function quickActionFor(item: ItemDTO) {
  if (item.status === 'OK') return { label: 'Acabando', icon: 'trending-down' as const, tone: statusColors.LOW };
  if (item.status === 'LOW') return { label: 'Acabou', icon: 'alert-circle' as const, tone: statusColors.OUT };
  return { label: 'Comprei', icon: 'check' as const, tone: statusColors.OK };
}

export function ItemRow({ item, buyerName, isMyTurn, onQuickAction }: ItemRowProps) {
  const action = quickActionFor(item);
  const meta =
    item.status === 'OK'
      ? `Próxima vez: ${buyerName}`
      : isMyTurn
        ? 'Sua vez de comprar'
        : `Vez de ${buyerName} · ${relativeTime(item.statusChangedAt)}`;

  return (
    <View style={styles.row}>
      <PressableScale
        style={styles.main}
        scaleTo={0.985}
        onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
        accessibilityLabel={`${item.name}, ${statusColors[item.status].label}. ${meta}`}
        accessibilityHint="Abre detalhes do item"
      >
        <CategoryIcon category={item.category} />
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
              {item.name}
            </Text>
            {item.critical ? <Feather name="star" size={13} color="#D99A1E" accessibilityLabel="Essencial" /> : null}
          </View>
          <View style={styles.metaRow}>
            {item.status !== 'OK' ? <View style={[styles.dot, { backgroundColor: statusColors[item.status].dot }]} /> : null}
            <Text
              variant="caption"
              color={isMyTurn && item.status !== 'OK' ? colors.primaryPressed : colors.textSecondary}
              numberOfLines={1}
              style={styles.shrink}
            >
              {meta}
            </Text>
          </View>
        </View>
      </PressableScale>
      <PressableScale
        onPress={() => onQuickAction(item)}
        haptic="medium"
        accessibilityLabel={`${action.label}: ${item.name}`}
        style={[styles.quick, { backgroundColor: action.tone.bg }]}
      >
        <Feather name={action.icon} size={16} color={action.tone.fg} />
        <Text variant="caption" color={action.tone.fg} style={styles.quickLabel}>
          {action.label}
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingRight: space.sm,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  shrink: { flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  quick: { width: 76, minHeight: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2 },
  quickLabel: { fontSize: 12 },
});

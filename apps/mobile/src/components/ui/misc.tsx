import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { Category, ItemStatus } from '@supplysync/shared';
import { CATEGORY_META } from '@/lib/categories';
import { initials } from '@/lib/format';
import { colors, radius, shadow, space, statusColors } from '@/theme';
import { PressableScale } from './Pressable';
import { Text } from './Text';

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>;
}

export function StatusPill({ status, compact }: { status: ItemStatus; compact?: boolean }) {
  const c = statusColors[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }, compact && styles.pillCompact]} accessibilityLabel={`Situação: ${c.label}`}>
      <View style={[styles.dot, { backgroundColor: c.dot }]} />
      <Text variant="label" color={c.fg} style={compact ? styles.pillTextCompact : undefined}>
        {c.label}
      </Text>
    </View>
  );
}

export function CategoryIcon({ category, size = 44 }: { category: Category; size?: number }) {
  const meta = CATEGORY_META[category];
  return (
    <View style={[styles.catIcon, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: meta.bg }]}>
      <MaterialCommunityIcons name={meta.icon} size={size * 0.5} color={meta.tint} />
    </View>
  );
}

const AVATAR_TINTS = ['#2F7A55', '#2F6F8A', '#7A4E8C', '#9A5B1F', '#B04A6A', '#4F6B2E', '#5B5FA8'];

function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length]!;
}

export function Avatar({ id, name, size = 36, ring }: { id: string; name: string; size?: number; ring?: boolean }) {
  return (
    <View
      accessibilityLabel={name}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tintFor(id) },
        ring && styles.avatarRing,
      ]}
    >
      <Text variant="label" color={colors.textInverse} style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {icon}
      <Text variant="label" color={selected ? colors.primaryPressed : colors.text}>
        {label}
      </Text>
      {selected ? <Feather name="check" size={16} color={colors.primaryPressed} /> : null}
    </PressableScale>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            haptic="selection"
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text variant="label" color={active ? colors.text : colors.textSecondary} align="center">
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function Banner({ tone = 'danger', children }: { tone?: 'danger' | 'info' | 'success'; children: ReactNode }) {
  const map = {
    danger: { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' as const },
    info: { bg: colors.surfaceMuted, fg: colors.text, icon: 'info' as const },
    success: { bg: colors.primarySoft, fg: colors.primaryPressed, icon: 'check-circle' as const },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: map.bg }]} accessibilityRole="alert">
      <Feather name={map.icon} size={18} color={map.fg} />
      <Text variant="label" color={map.fg} style={styles.flex}>
        {children}
      </Text>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text variant="overline" color={colors.textSecondary} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={28} color={colors.primary} />
      </View>
      <Text variant="headline" align="center">
        {title}
      </Text>
      <Text color={colors.textSecondary} align="center">
        {body}
      </Text>
      {action}
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = 'default',
}: {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  tone?: 'default' | 'primary';
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.iconBtn, tone === 'primary' && { backgroundColor: colors.primary }]}
    >
      <Feather name={icon} size={20} color={tone === 'primary' ? colors.textInverse : colors.text} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardPadded: { padding: space.lg },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillCompact: { paddingHorizontal: space.sm, paddingVertical: 3 },
  pillTextCompact: { fontSize: 12, lineHeight: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  catIcon: { alignItems: 'center', justifyContent: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarRing: { borderWidth: 3, borderColor: colors.surface },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: space.sm },
  segmentActive: { backgroundColor: colors.surface, ...shadow.card },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
  flex: { flex: 1 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl, paddingHorizontal: space.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PLAN_LIMITS } from '@supplysync/shared';
import { useActiveHouseholdId, useBulkCreateItems } from '@/api/hooks';
import { useSession } from '@/auth/AuthProvider';
import { Banner, Button, PressableScale, Screen, Text } from '@/components/ui';
import { STARTER_ICONS, STARTER_ITEMS } from '@/lib/categories';
import { apiErrorToForm } from '@/lib/forms';
import { colors, palette, radius, space } from '@/theme';

/**
 * Inventário inicial. Vem pré-marcado com o que a pessoa reconheceu no onboarding:
 * a reflexão feita lá vira configuração aqui.
 */
export default function Starter() {
  const { onboarding } = useSession();
  const householdId = useActiveHouseholdId();
  const bulk = useBulkCreateItems(householdId);
  const [selected, setSelected] = useState<string[]>([]);
  const [critical, setCritical] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const pains = onboarding?.pains ?? [];
    setSelected(pains.length ? pains : ['toilet-paper', 'dish-soap']);
    setCritical(STARTER_ITEMS.filter((i) => i.critical && pains.includes(i.key)).map((i) => i.key));
  }, [onboarding]);

  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  const max = PLAN_LIMITS.FREE.maxItems;

  async function save() {
    const items = STARTER_ITEMS.filter((i) => selected.includes(i.key)).map((i) => ({
      name: i.name,
      category: i.category,
      critical: critical.includes(i.key),
    }));
    try {
      if (items.length) await bulk.mutateAsync(items);
      router.replace('/(tabs)');
    } catch (err) {
      setMessage(apiErrorToForm(err).message);
    }
  }

  return (
    <Screen
      title="O que sua casa consome?"
      subtitle="Já marcamos o que você disse que falta por aí. Toque na estrela para definir o que é essencial: esses itens geram aviso para todos quando acabam."
      footer={
        <>
          <Button label={selected.length ? `Adicionar ${selected.length} itens` : 'Continuar sem itens'} onPress={() => void save()} loading={bulk.isPending} />
          <Text variant="caption" color={colors.textSecondary} align="center">
            Você pode mudar tudo depois. Plano gratuito: até {max} itens.
          </Text>
        </>
      }
    >
      {message ? <Banner>{message}</Banner> : null}
      <View style={styles.list}>
        {STARTER_ITEMS.map((item) => {
          const on = selected.includes(item.key);
          const star = critical.includes(item.key);
          return (
            <View key={item.key} style={[styles.row, on && styles.rowOn]}>
              <PressableScale
                style={styles.main}
                haptic="selection"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.name}
                onPress={() => {
                  setSelected((l) => toggle(l, item.key));
                  if (on) setCritical((l) => l.filter((k) => k !== item.key));
                }}
              >
                <View style={[styles.icon, on && styles.iconOn]}>
                  <MaterialCommunityIcons name={STARTER_ICONS[item.key] ?? 'package-variant'} size={22} color={on ? palette.green700 : colors.icon} />
                </View>
                <Text variant="bodyStrong" color={on ? colors.text : colors.textSecondary} style={styles.flex}>
                  {item.name}
                </Text>
              </PressableScale>
              {on ? (
                <PressableScale
                  haptic="selection"
                  hitSlop={8}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: star }}
                  accessibilityLabel={`${item.name} é essencial`}
                  onPress={() => setCritical((l) => toggle(l, item.key))}
                  style={styles.star}
                >
                  <MaterialCommunityIcons name={star ? 'star' : 'star-outline'} size={24} color={star ? '#D99A1E' : colors.icon} />
                </PressableScale>
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingRight: space.sm,
  },
  rowOn: { borderColor: palette.green300 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: palette.green50 },
  flex: { flex: 1 },
  star: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

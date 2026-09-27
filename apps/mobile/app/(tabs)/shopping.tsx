import { useMemo } from 'react';
import { RefreshControl, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { ItemDTO } from '@supplysync/shared';
import { useItems } from '@/api/hooks';
import { Banner, Button, CategoryIcon, EmptyState, IconButton, PressableScale, Screen, SectionTitle, Text } from '@/components/ui';
import { useHouseContext } from '@/hooks/useHouseContext';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { formatCents } from '@/lib/format';
import { colors, radius, space, statusColors } from '@/theme';

/**
 * Lista de compras derivada do inventário: nada para digitar.
 * Tudo que está "acabando" ou "acabou" aparece aqui, separado por de quem é a vez.
 */
export default function ShoppingTab() {
  const { myId, householdId, household, nameOf } = useHouseContext();
  const items = useItems(householdId);
  useRefreshOnFocus(items.refetch);

  const { mine, others } = useMemo(() => {
    const needed = (items.data ?? []).filter((i) => i.status !== 'OK');
    return {
      mine: needed.filter((i) => i.suggestedBuyerId === myId),
      others: needed.filter((i) => i.suggestedBuyerId !== myId),
    };
  }, [items.data, myId]);

  const estimated = [...mine, ...others].reduce((sum, i) => sum + (i.typicalPriceCents ?? 0), 0);

  async function share() {
    const line = (i: ItemDTO) => `${i.status === 'OUT' ? '[acabou]' : '[acabando]'} ${i.name}${i.unit ? ` (${i.unit})` : ''}`;
    const text = [
      `Lista de compras · ${household.data?.name ?? 'Casa'}`,
      '',
      ...(mine.length ? ['Minha vez:', ...mine.map(line), ''] : []),
      ...(others.length ? ['Outras pessoas:', ...others.map((i) => `${line(i)} (vez de ${nameOf(i.suggestedBuyerId)})`)] : []),
      '',
      'Enviado pelo SupplySync',
    ].join('\n');
    await Share.share({ message: text });
  }

  const empty = mine.length === 0 && others.length === 0;

  return (
    <Screen
      title="Compras"
      subtitle={empty ? undefined : estimated > 0 ? `Estimativa: ${formatCents(estimated)}` : 'O que a casa precisa repor'}
      right={!empty ? <IconButton icon="share" label="Compartilhar lista" onPress={() => void share()} /> : undefined}
      refreshControl={<RefreshControl refreshing={items.isRefetching} onRefresh={() => void items.refetch()} tintColor={colors.primary} />}
      footer={<Button label="Registrar compra avulsa" variant="secondary" icon="plus" onPress={() => router.push('/purchase/new')} />}
    >
      {items.isError ? <Banner>Não foi possível carregar a lista.</Banner> : null}
      {empty && !items.isLoading ? (
        <EmptyState
          icon="check-circle"
          title="Nada para comprar"
          body="Quando alguém sinalizar que um item está acabando, ele aparece aqui automaticamente."
        />
      ) : null}

      {mine.length > 0 ? (
        <View style={styles.group}>
          <SectionTitle>{`Sua vez · ${mine.length}`}</SectionTitle>
          {mine.map((i) => (
            <ShoppingRow key={i.id} item={i} caption="Sua vez" />
          ))}
        </View>
      ) : null}

      {others.length > 0 ? (
        <View style={styles.group}>
          <SectionTitle>{`Outras pessoas · ${others.length}`}</SectionTitle>
          {others.map((i) => (
            <ShoppingRow key={i.id} item={i} caption={`Vez de ${nameOf(i.suggestedBuyerId)}`} />
          ))}
          <Text variant="caption" color={colors.textSecondary}>
            Passou no mercado? Pode comprar mesmo não sendo sua vez: o valor entra na divisão do mesmo jeito.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

function ShoppingRow({ item, caption }: { item: ItemDTO; caption: string }) {
  return (
    <View style={styles.row}>
      <CategoryIcon category={item.category} size={40} />
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.dot, { backgroundColor: statusColors[item.status].dot }]} />
          <Text variant="caption" color={statusColors[item.status].fg}>
            {statusColors[item.status].label}
          </Text>
        </View>
        <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
          {caption}
          {item.typicalPriceCents ? ` · ~${formatCents(item.typicalPriceCents)}` : ''}
        </Text>
      </View>
      <PressableScale
        onPress={() => router.push({ pathname: '/purchase/new', params: { itemId: item.id } })}
        accessibilityLabel={`Comprei ${item.name}`}
        haptic="medium"
        style={styles.buy}
      >
        <Text variant="label" color={colors.textInverse}>
          Comprei
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { flex: 1, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  buy: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: space.md, minHeight: 40, justifyContent: 'center' },
});

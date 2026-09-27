import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import type { ItemDTO } from '@supplysync/shared';
import { useItems, useReportStatus } from '@/api/hooks';
import { ItemRow } from '@/components/ItemRow';
import { Banner, Button, Card, EmptyState, IconButton, Screen, SectionTitle, Text } from '@/components/ui';
import { useHouseContext } from '@/hooks/useHouseContext';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { firstName } from '@/lib/format';
import { getPushPermission, registerForPush } from '@/lib/notifications';
import { colors, palette, radius, space } from '@/theme';

export default function HomeTab() {
  const { me, myId, householdId, household, nameOf } = useHouseContext();
  const items = useItems(householdId);
  useRefreshOnFocus(items.refetch);
  useRefreshOnFocus(household.refetch);
  const report = useReportStatus(householdId);
  const [pushAsk, setPushAsk] = useState(false);

  useEffect(() => {
    void getPushPermission().then((granted) => setPushAsk(!granted));
  }, []);

  const groups = useMemo(() => {
    const list = items.data ?? [];
    return {
      out: list.filter((i) => i.status === 'OUT'),
      low: list.filter((i) => i.status === 'LOW'),
      ok: list.filter((i) => i.status === 'OK'),
    };
  }, [items.data]);

  const myTurnCount = (items.data ?? []).filter((i) => i.status !== 'OK' && i.suggestedBuyerId === myId).length;

  function quickAction(item: ItemDTO) {
    if (item.status === 'OUT') {
      router.push({ pathname: '/purchase/new', params: { itemId: item.id } });
      return;
    }
    report.mutate({ itemId: item.id, status: item.status === 'OK' ? 'LOW' : 'OUT' });
  }

  const renderGroup = (title: string, list: ItemDTO[]) =>
    list.length === 0 ? null : (
      <Animated.View layout={LinearTransition} style={styles.group}>
        <SectionTitle>{`${title} · ${list.length}`}</SectionTitle>
        {list.map((item) => (
          <Animated.View key={item.id} layout={LinearTransition.springify().damping(18)} entering={FadeIn}>
            <ItemRow
              item={item}
              buyerName={nameOf(item.suggestedBuyerId)}
              isMyTurn={item.suggestedBuyerId === myId}
              onQuickAction={quickAction}
            />
          </Animated.View>
        ))}
      </Animated.View>
    );

  const firstLoad = items.isLoading || household.isLoading;

  return (
    <Screen
      title={household.data?.name ?? ' '}
      subtitle={me.data ? `Oi, ${firstName(me.data.user.displayName)}. Este é o estado da sua casa agora.` : undefined}
      right={<IconButton icon="plus" label="Adicionar item" tone="primary" onPress={() => router.push('/item/form')} />}
      refreshControl={
        <RefreshControl
          refreshing={items.isRefetching}
          onRefresh={() => void Promise.all([items.refetch(), household.refetch()])}
          tintColor={colors.primary}
        />
      }
    >
      {firstLoad ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : items.isError ? (
        <Banner>Não foi possível carregar os itens. Puxe para baixo para tentar de novo.</Banner>
      ) : (items.data ?? []).length === 0 ? (
        <EmptyState
          icon="package"
          title="Sua casa ainda está vazia"
          body="Adicione os itens que vocês consomem sempre. Comece pelos que mais faltam."
          action={<Button label="Adicionar primeiro item" icon="plus" onPress={() => router.push('/item/form')} />}
        />
      ) : (
        <>
          <Summary out={groups.out.length} low={groups.low.length} mine={myTurnCount} />

          {pushAsk ? (
            <Card style={styles.pushCard}>
              <View style={styles.pushRow}>
                <Feather name="bell" size={20} color={colors.primary} />
                <Text variant="label" style={styles.flex}>
                  Quer ser avisado quando um item essencial acabar e for sua vez de comprar?
                </Text>
              </View>
              <View style={styles.pushActions}>
                <Button label="Agora não" variant="ghost" size="md" full={false} onPress={() => setPushAsk(false)} />
                <Button
                  label="Ativar avisos"
                  size="md"
                  full={false}
                  onPress={() => void registerForPush().finally(() => setPushAsk(false))}
                />
              </View>
            </Card>
          ) : null}

          {renderGroup('Acabou', groups.out)}
          {renderGroup('Acabando', groups.low)}
          {renderGroup('Em dia', groups.ok)}
          {report.isError ? <Banner>Não foi possível sinalizar. Verifique a conexão e tente de novo.</Banner> : null}
        </>
      )}
    </Screen>
  );
}

function Summary({ out, low, mine }: { out: number; low: number; mine: number }) {
  const allGood = out === 0 && low === 0;
  return (
    <View style={[styles.summary, allGood && styles.summaryGood]}>
      <View style={styles.flex}>
        <Text variant="headline" color={allGood ? palette.green900 : colors.text}>
          {allGood ? 'Tudo em dia' : mine > 0 ? `${mine} ${mine === 1 ? 'item é' : 'itens são'} sua vez` : 'A casa precisa de reposição'}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          {allGood ? 'Nada faltando. Sinalize assim que algo começar a acabar.' : `${out} acabaram · ${low} acabando`}
        </Text>
      </View>
      {!allGood ? (
        <Button label="Ver compras" size="md" full={false} variant="secondary" onPress={() => router.push('/(tabs)/shopping')} />
      ) : (
        <Feather name="check-circle" size={28} color={palette.green600} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: space.xxxl },
  group: { gap: space.sm },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryGood: { backgroundColor: palette.green50, borderColor: palette.green100 },
  pushCard: { gap: space.md },
  pushRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  pushActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
});

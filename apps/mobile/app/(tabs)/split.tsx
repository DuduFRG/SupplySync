import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { PurchaseDTO } from '@supplysync/shared';
import { useBalances, useCreateSettlement, usePurchases } from '@/api/hooks';
import { Avatar, Banner, Button, Card, EmptyState, Screen, SectionTitle, Text } from '@/components/ui';
import { useHouseContext } from '@/hooks/useHouseContext';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { formatCents, relativeTime } from '@/lib/format';
import { colors, palette, radius, space } from '@/theme';

export default function SplitTab() {
  const { myId, householdId, household, nameOf, names } = useHouseContext();
  const balances = useBalances(householdId);
  const purchases = usePurchases(householdId);
  const settle = useCreateSettlement(householdId);
  useRefreshOnFocus(balances.refetch);
  useRefreshOnFocus(purchases.refetch);

  const formerNames = new Map((balances.data?.formerMembers ?? []).map((f) => [f.userId, f.displayName]));
  const label = (id: string) => (names.has(id) || id === myId ? nameOf(id) : (formerNames.get(id) ?? 'Ex-morador'));
  // Avatares usam o nome real (iniciais), mesmo quando o rótulo é "Você".
  const fullName = (id: string) => names.get(id) ?? formerNames.get(id) ?? label(id);

  const mine = balances.data?.balances.find((b) => b.userId === myId)?.netCents ?? 0;
  const myTransfers = (balances.data?.transfers ?? []).filter((t) => t.fromUserId === myId || t.toUserId === myId);
  const otherTransfers = (balances.data?.transfers ?? []).filter((t) => t.fromUserId !== myId && t.toUserId !== myId);
  const allPurchases = purchases.data?.pages.flatMap((p) => p.purchases) ?? [];
  const historyDays = purchases.data?.pages[0]?.historyDays;

  function confirmSettlement(t: { fromUserId: string; toUserId: string; amountCents: number }) {
    const iPay = t.fromUserId === myId;
    Alert.alert(
      'Registrar pagamento',
      iPay
        ? `Confirme que você pagou ${formatCents(t.amountCents)} para ${label(t.toUserId)}.`
        : `Confirme que ${label(t.fromUserId)} te pagou ${formatCents(t.amountCents)}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => settle.mutate(t) },
      ],
    );
  }

  const hero =
    mine > 0
      ? { title: `Você tem ${formatCents(mine)} a receber`, tone: palette.green50, fg: palette.green900 }
      : mine < 0
        ? { title: `Você deve ${formatCents(-mine)}`, tone: palette.amber50, fg: palette.amber700 }
        : { title: 'Suas contas estão em dia', tone: colors.surface, fg: colors.text };

  return (
    <Screen
      title="Contas"
      subtitle="Quem pagou o quê, e o acerto mais simples."
      refreshControl={
        <RefreshControl
          refreshing={balances.isRefetching}
          onRefresh={() => void Promise.all([balances.refetch(), purchases.refetch()])}
          tintColor={colors.primary}
        />
      }
    >
      {balances.isError ? <Banner>Não foi possível carregar os saldos.</Banner> : null}
      {settle.isError ? <Banner>Não foi possível registrar o pagamento.</Banner> : null}

      <View style={[styles.hero, { backgroundColor: hero.tone }]}>
        <Text variant="title" color={hero.fg}>
          {hero.title}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          Saldo considerando todas as compras e pagamentos registrados.
        </Text>
      </View>

      {myTransfers.length > 0 ? (
        <View style={styles.group}>
          <SectionTitle>Para acertar</SectionTitle>
          {myTransfers.map((t) => (
            <Card key={`${t.fromUserId}-${t.toUserId}`} style={styles.transfer}>
              <Avatar id={t.fromUserId === myId ? t.toUserId : t.fromUserId} name={fullName(t.fromUserId === myId ? t.toUserId : t.fromUserId)} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">
                  {t.fromUserId === myId ? `Você paga ${label(t.toUserId)}` : `${label(t.fromUserId)} te paga`}
                </Text>
                <Text variant="headline" color={t.fromUserId === myId ? palette.amber700 : palette.green700}>
                  {formatCents(t.amountCents)}
                </Text>
              </View>
              <Button label="Pago" size="md" full={false} variant="secondary" icon="check" onPress={() => confirmSettlement(t)} />
            </Card>
          ))}
        </View>
      ) : null}

      {otherTransfers.length > 0 ? (
        <View style={styles.group}>
          <SectionTitle>Entre outras pessoas</SectionTitle>
          {otherTransfers.map((t) => (
            <View key={`${t.fromUserId}-${t.toUserId}`} style={styles.line}>
              <Text variant="label" style={styles.flex}>
                {label(t.fromUserId)} paga {label(t.toUserId)}
              </Text>
              <Text variant="bodyStrong">{formatCents(t.amountCents)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {(household.data?.members.length ?? 0) > 1 ? (
        <View style={styles.group}>
          <SectionTitle>Saldo por pessoa</SectionTitle>
          <Card padded={false}>
            {(balances.data?.balances ?? []).map((b, i) => (
              <View key={b.userId} style={[styles.balanceRow, i > 0 && styles.divider]}>
                <Avatar id={b.userId} name={fullName(b.userId)} size={32} />
                <Text variant="label" style={styles.flex}>
                  {label(b.userId)}
                </Text>
                <Text variant="bodyStrong" color={b.netCents > 0 ? palette.green700 : b.netCents < 0 ? palette.amber700 : colors.textSecondary}>
                  {b.netCents > 0 ? '+' : ''}
                  {formatCents(b.netCents)}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <View style={styles.group}>
        <SectionTitle>Histórico de compras</SectionTitle>
        {allPurchases.length === 0 && !purchases.isLoading ? (
          <EmptyState icon="file-text" title="Nenhuma compra ainda" body="Quando alguém tocar em “Comprei”, a compra e a divisão aparecem aqui." />
        ) : (
          allPurchases.map((p) => <PurchaseRow key={p.id} purchase={p} myId={myId} label={label} />)
        )}
        {purchases.hasNextPage ? (
          <Button label="Carregar mais" variant="ghost" loading={purchases.isFetchingNextPage} onPress={() => void purchases.fetchNextPage()} />
        ) : historyDays && allPurchases.length > 0 ? (
          <Text variant="caption" color={colors.textSecondary} align="center">
            Mostrando os últimos {historyDays} dias do seu plano. Os saldos consideram todo o histórico.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function PurchaseRow({ purchase, myId, label }: { purchase: PurchaseDTO; myId: string | null; label: (id: string) => string }) {
  const myShare = purchase.shares.find((s) => s.userId === myId)?.shareCents;
  return (
    <View style={styles.purchase}>
      <View style={styles.purchaseIcon}>
        <Feather name="shopping-bag" size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {purchase.title}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          {purchase.buyerId === myId ? 'Você pagou' : `${label(purchase.buyerId)} pagou`} · {relativeTime(purchase.purchasedAt)}
          {myShare !== undefined ? ` · sua parte ${formatCents(myShare)}` : ''}
        </Text>
      </View>
      <Text variant="bodyStrong">{formatCents(purchase.amountCents)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { padding: space.xl, borderRadius: radius.lg, gap: space.xs, borderWidth: 1, borderColor: colors.border },
  group: { gap: space.sm },
  transfer: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  purchase: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  purchaseIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});

import { useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { FAMILY_PRICE_RANGE_BRL, householdNameSchema, displayNameSchema, type InviteDTO } from '@supplysync/shared';
import { useCreateInvite, useDeleteAccount, useLeaveHousehold, useRemoveMember, useRenameHousehold, useUpdateMe } from '@/api/hooks';
import { useSession } from '@/auth/AuthProvider';
import { Avatar, Banner, Button, Card, SectionTitle, Screen, Text, TextField } from '@/components/ui';
import { useHouseContext } from '@/hooks/useHouseContext';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { apiErrorToForm } from '@/lib/forms';
import { getPushPermission, registerForPush, unregisterPushToken } from '@/lib/notifications';
import { colors, palette, radius, space } from '@/theme';

export default function SettingsTab() {
  const { signOut } = useSession();
  const { me, myId, householdId, household } = useHouseContext();
  const h = household.data;
  const isOwner = h?.myRole === 'OWNER';
  useRefreshOnFocus(household.refetch);

  const [displayName, setDisplayName] = useState('');
  const [houseName, setHouseName] = useState('');
  const [invite, setInvite] = useState<InviteDTO | null>(null);
  const [push, setPush] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const updateMe = useUpdateMe();
  const rename = useRenameHousehold(householdId);
  const createInvite = useCreateInvite(householdId);
  const leave = useLeaveHousehold(householdId);
  const removeMember = useRemoveMember(householdId);
  const deleteAccount = useDeleteAccount();

  useEffect(() => setDisplayName(me.data?.user.displayName ?? ''), [me.data]);
  useEffect(() => setHouseName(h?.name ?? ''), [h?.name]);
  useEffect(() => void getPushPermission().then(setPush), []);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null);
    setSaved(null);
    try {
      await fn();
      if (ok) setSaved(ok);
    } catch (err) {
      setError(apiErrorToForm(err).message);
    }
  };

  async function newInvite() {
    await run(async () => setInvite(await createInvite.mutateAsync()));
  }

  async function shareInvite() {
    if (!invite || !h) return;
    const pretty = `${invite.code.slice(0, 4)}-${invite.code.slice(4)}`;
    await Share.share({
      message: `Entre na nossa casa "${h.name}" no SupplySync. Baixe o app e use o código ${pretty} (vale por 7 dias).`,
    });
  }

  function confirmRemove(userId: string, name: string) {
    Alert.alert('Remover morador', `${name} deixará de ver a casa. O histórico de compras dele(a) continua nas contas.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => void run(() => removeMember.mutateAsync(userId)) },
    ]);
  }

  function confirmLeave() {
    Alert.alert('Sair da casa', 'Você deixa de ver itens e contas desta casa. Se for a última pessoa, a casa é apagada.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => void run(async () => {
          await leave.mutateAsync();
          router.replace('/');
        }),
      },
    ]);
  }

  async function togglePush(next: boolean) {
    if (next) setPush((await registerForPush()) === 'granted');
    else {
      await unregisterPushToken().catch(() => undefined);
      setPush(false);
    }
  }

  async function confirmDelete() {
    await run(async () => {
      await deleteAccount.mutateAsync(password);
      await signOut({ remote: false });
      router.replace('/');
    });
  }

  return (
    <Screen title="Ajustes">
      {error ? <Banner>{error}</Banner> : null}
      {saved ? <Banner tone="success">{saved}</Banner> : null}

      {/* Perfil */}
      <SectionTitle>Seu perfil</SectionTitle>
      <Card style={styles.stack}>
        <TextField label="Seu nome" value={displayName} onChangeText={setDisplayName} maxLength={40} />
        <Text variant="caption" color={colors.textSecondary}>
          {me.data?.user.email}
        </Text>
        <Button
          label="Salvar nome"
          size="md"
          variant="secondary"
          loading={updateMe.isPending}
          disabled={!displayNameSchema.safeParse(displayName).success || displayName === me.data?.user.displayName}
          onPress={() => void run(() => updateMe.mutateAsync(displayName), 'Nome atualizado')}
        />
      </Card>

      {/* Casa */}
      <SectionTitle>Casa</SectionTitle>
      <Card style={styles.stack}>
        {isOwner ? (
          <>
            <TextField label="Nome da casa" value={houseName} onChangeText={setHouseName} maxLength={40} />
            <Button
              label="Salvar nome da casa"
              size="md"
              variant="secondary"
              loading={rename.isPending}
              disabled={!householdNameSchema.safeParse(houseName).success || houseName === h?.name}
              onPress={() => void run(() => rename.mutateAsync(houseName), 'Casa atualizada')}
            />
          </>
        ) : (
          <Text variant="headline">{h?.name}</Text>
        )}
      </Card>

      <SectionTitle>{`Moradores · ${h?.members.length ?? 0} de ${h?.limits.maxMembers ?? '-'}`}</SectionTitle>
      <Card padded={false}>
        {h?.members.map((m, i) => (
          <View key={m.userId} style={[styles.member, i > 0 && styles.divider]}>
            <Avatar id={m.userId} name={m.displayName} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">
                {m.displayName}
                {m.userId === myId ? ' (você)' : ''}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                {m.role === 'OWNER' ? 'Administra a casa' : 'Morador'}
              </Text>
            </View>
            {isOwner && m.userId !== myId ? (
              <Button label="Remover" size="md" variant="ghost" full={false} onPress={() => confirmRemove(m.userId, m.displayName)} />
            ) : null}
          </View>
        ))}
      </Card>

      {invite ? (
        <Card style={[styles.stack, styles.invite]}>
          <Text variant="overline" color={palette.green700}>
            Código de convite
          </Text>
          <Text variant="display" selectable style={styles.code}>
            {invite.code.slice(0, 4)}-{invite.code.slice(4)}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            Vale por 7 dias e para até {invite.maxUses} pessoas. Por segurança, ele não será mostrado de novo.
          </Text>
          <Button label="Enviar convite" icon="share-2" onPress={() => void shareInvite()} />
        </Card>
      ) : (
        <Button label="Convidar alguém da casa" icon="user-plus" variant="secondary" loading={createInvite.isPending} onPress={() => void newInvite()} />
      )}

      {/* Plano */}
      <SectionTitle>Plano</SectionTitle>
      <Card style={styles.stack}>
        <View style={styles.planRow}>
          <Text variant="headline">{h?.plan === 'FAMILY' ? 'Família' : 'Gratuito'}</Text>
          <View style={styles.planBadge}>
            <Text variant="caption" color={palette.green700}>
              {h ? `${h.itemCount}/${h.limits.maxItems} itens` : ''}
            </Text>
          </View>
        </View>
        {h?.plan !== 'FAMILY' ? (
          <Text variant="label" color={colors.textSecondary}>
            O plano Família libera até 8 moradores, 300 itens e histórico completo, por R$ {FAMILY_PRICE_RANGE_BRL.min} a R$ {FAMILY_PRICE_RANGE_BRL.max} por mês. Em breve nas lojas.
          </Text>
        ) : null}
      </Card>

      {/* Preferências */}
      <SectionTitle>Preferências</SectionTitle>
      <Card style={styles.stack}>
        <View style={styles.planRow}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">Avisos de itens essenciais</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Quando algo essencial acabar e quando for sua vez.
            </Text>
          </View>
          <Switch
            value={push}
            onValueChange={(v) => void togglePush(v)}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel="Avisos de itens essenciais"
          />
        </View>
        <Button label="Rever o combinado da casa" variant="ghost" size="md" icon="book-open" onPress={() => router.push('/onboarding')} />
      </Card>

      {/* Conta */}
      <SectionTitle>Conta</SectionTitle>
      <Button label="Sair da conta" variant="secondary" icon="log-out" onPress={() => void signOut()} />
      <Button label="Sair desta casa" variant="danger" icon="home" onPress={confirmLeave} />

      {deleting ? (
        <Card style={[styles.stack, styles.danger]}>
          <View style={styles.planRow}>
            <Feather name="alert-triangle" size={18} color={colors.danger} />
            <Text variant="bodyStrong" color={colors.danger} style={styles.flex}>
              Excluir conta permanentemente
            </Text>
          </View>
          <Text variant="caption" color={colors.textSecondary}>
            Seus dados pessoais são apagados. Compras já registradas continuam nas contas da casa, como “Ex-morador”, para não prejudicar quem fica.
          </Text>
          <TextField label="Confirme sua senha" value={password} onChangeText={setPassword} secureTextEntry secureToggle autoComplete="current-password" />
          <Button label="Excluir minha conta" variant="danger" loading={deleteAccount.isPending} disabled={!password} onPress={() => void confirmDelete()} />
          <Button label="Cancelar" variant="ghost" onPress={() => setDeleting(false)} />
        </Card>
      ) : (
        <Button label="Excluir conta" variant="ghost" onPress={() => setDeleting(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.md },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  invite: { borderColor: palette.green200, backgroundColor: palette.green50 },
  code: { letterSpacing: 4 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, justifyContent: 'space-between' },
  planBadge: { backgroundColor: palette.green50, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  danger: { borderColor: colors.dangerSoft },
});

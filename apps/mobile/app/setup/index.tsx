import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { createHouseholdSchema, joinHouseholdSchema } from '@supplysync/shared';
import { useCreateHousehold, useJoinHousehold, useMe } from '@/api/hooks';
import { Banner, Button, Card, PressableScale, Screen, Text, TextField } from '@/components/ui';
import { apiErrorToForm, validate, type FieldErrors } from '@/lib/forms';
import { firstName } from '@/lib/format';
import { colors, radius, space } from '@/theme';

type Mode = 'choose' | 'create' | 'join';

export default function Setup() {
  const me = useMe();
  const [mode, setMode] = useState<Mode>('choose');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const create = useCreateHousehold();
  const join = useJoinHousehold();

  async function submitCreate() {
    const v = validate(createHouseholdSchema, { name });
    if ('errors' in v) return setErrors(v.errors);
    try {
      await create.mutateAsync(v.data.name);
      router.replace('/setup/starter');
    } catch (err) {
      const e = apiErrorToForm(err);
      setMessage(e.message);
      setErrors(e.fields);
    }
  }

  async function submitJoin() {
    const v = validate(joinHouseholdSchema, { code });
    if ('errors' in v) return setErrors(v.errors);
    try {
      await join.mutateAsync(v.data.code);
      router.replace('/(tabs)');
    } catch (err) {
      const e = apiErrorToForm(err);
      setMessage(e.message);
      setErrors(e.fields);
    }
  }

  const greeting = me.data ? `Oi, ${firstName(me.data.user.displayName)}.` : 'Oi.';

  if (mode === 'create') {
    return (
      <Screen
        back={false}
        right={<Button label="Voltar" variant="ghost" size="md" full={false} onPress={() => setMode('choose')} />}
        title="Dê um nome para a casa"
        subtitle="É assim que ela vai aparecer para quem você convidar."
        footer={<Button label="Criar casa" onPress={() => void submitCreate()} loading={create.isPending} />}
      >
        {message ? <Banner>{message}</Banner> : null}
        <TextField
          label="Nome da casa"
          placeholder="Ex.: Apê da Vila, Casa dos Silva"
          value={name}
          onChangeText={setName}
          error={errors.name}
          maxLength={40}
          autoFocus
        />
      </Screen>
    );
  }

  if (mode === 'join') {
    return (
      <Screen
        right={<Button label="Voltar" variant="ghost" size="md" full={false} onPress={() => setMode('choose')} />}
        title="Entrar em uma casa"
        subtitle="Peça o código de convite para quem já usa o SupplySync na sua casa."
        footer={<Button label="Entrar na casa" onPress={() => void submitJoin()} loading={join.isPending} />}
      >
        {message ? <Banner>{message}</Banner> : null}
        <TextField
          label="Código do convite"
          placeholder="ABCD-EFGH"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          error={errors.code}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          autoFocus
        />
      </Screen>
    );
  }

  return (
    <Screen title={greeting} subtitle="Agora vamos colocar sua casa no SupplySync. Como você quer começar?">
      <Option
        icon="home"
        title="Criar uma casa"
        body="Você monta o inventário e convida quem mora com você."
        onPress={() => setMode('create')}
      />
      <Option
        icon="log-in"
        title="Tenho um código de convite"
        body="Alguém da sua casa já começou. Entre com o código."
        onPress={() => setMode('join')}
      />
      <Card style={styles.note}>
        <Text variant="label" color={colors.textSecondary}>
          No plano gratuito você participa de 1 casa com até 4 moradores e 20 itens. Dá para começar sem cartão.
        </Text>
      </Card>
    </Screen>
  );
}

function Option({ icon, title, body, onPress }: { icon: 'home' | 'log-in'; title: string; body: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.option} accessibilityLabel={title} accessibilityHint={body}>
      <View style={styles.optionIcon}>
        <Feather name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text variant="headline">{title}</Text>
        <Text variant="label" color={colors.textSecondary}>
          {body}
        </Text>
      </View>
      <Feather name="chevron-right" size={22} color={colors.icon} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: space.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  note: { backgroundColor: colors.surfaceMuted, shadowOpacity: 0, elevation: 0, borderWidth: 0 },
});

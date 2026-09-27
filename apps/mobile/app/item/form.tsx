import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BUYER_MODES, CATEGORIES, itemCreateSchema, type BuyerMode, type Category } from '@supplysync/shared';
import { useArchiveItem, useCreateItem, useItems, useUpdateItem } from '@/api/hooks';
import { Avatar, Banner, Button, Chip, Screen, SectionTitle, Segmented, Text, TextField } from '@/components/ui';
import { useHouseContext } from '@/hooks/useHouseContext';
import { CATEGORY_META } from '@/lib/categories';
import { apiErrorToForm, validate, type FieldErrors } from '@/lib/forms';
import { maskCurrency, parseCurrencyInput } from '@/lib/format';
import { colors, space } from '@/theme';

const MODE_HELP: Record<BuyerMode, string> = {
  ROTATION: 'Cada reposição, uma pessoa diferente, na ordem da casa.',
  PREFERRED: 'Sempre a mesma pessoa. Útil para itens que só alguém sabe escolher.',
  FAIR: 'Quem gastou menos nos últimos 60 dias compra a próxima.',
};

export default function ItemForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { householdId, household, myId } = useHouseContext();
  const items = useItems(householdId);
  const existing = id ? items.data?.find((i) => i.id === id) : undefined;

  const create = useCreateItem(householdId);
  const update = useUpdateItem(householdId, id ?? '');
  const archive = useArchiveItem(householdId);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('CLEANING');
  const [critical, setCritical] = useState(false);
  const [buyerMode, setBuyerMode] = useState<BuyerMode>('ROTATION');
  const [preferredUserId, setPreferred] = useState<string | null>(null);
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);

  // Preenche uma única vez: refetch em segundo plano não pode apagar o que a pessoa está editando.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!existing || hydrated.current) return;
    hydrated.current = true;
    setName(existing.name);
    setCategory(existing.category);
    setCritical(existing.critical);
    setBuyerMode(existing.buyerMode);
    setPreferred(existing.preferredUserId);
    setUnit(existing.unit ?? '');
    setPrice(existing.typicalPriceCents ? maskCurrency(String(existing.typicalPriceCents)) : '');
  }, [existing]);

  async function save() {
    setMessage(null);
    const v = validate(itemCreateSchema, {
      name,
      category,
      critical,
      buyerMode,
      preferredUserId: buyerMode === 'PREFERRED' ? (preferredUserId ?? myId) : null,
      unit: unit.trim() || null,
      typicalPriceCents: parseCurrencyInput(price),
    });
    if ('errors' in v) return setErrors(v.errors);
    setErrors({});
    try {
      if (existing) await update.mutateAsync(v.data);
      else await create.mutateAsync(v.data);
      router.back();
    } catch (err) {
      const e = apiErrorToForm(err);
      setMessage(e.message);
      setErrors(e.fields);
    }
  }

  function confirmArchive() {
    if (!existing) return;
    Alert.alert('Arquivar item', `“${existing.name}” sai da lista. O histórico de compras continua nas contas.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Arquivar',
        style: 'destructive',
        onPress: () =>
          void archive.mutateAsync(existing.id).then(
            () => router.dismissTo('/(tabs)'),
            (err: unknown) => setMessage(apiErrorToForm(err).message),
          ),
      },
    ]);
  }

  return (
    <Screen
      modal
      back="close"
      title={existing ? 'Editar item' : 'Novo item'}
      subtitle={existing ? undefined : 'Algo que a casa consome e precisa repor de tempos em tempos.'}
      footer={
        <>
          <Button label={existing ? 'Salvar alterações' : 'Adicionar item'} onPress={() => void save()} loading={create.isPending || update.isPending} />
          {existing ? <Button label="Arquivar item" variant="ghost" onPress={confirmArchive} /> : null}
        </>
      }
    >
      {message ? <Banner>{message}</Banner> : null}
      <TextField label="Nome" placeholder="Ex.: Papel higiênico" value={name} onChangeText={setName} error={errors.name} maxLength={40} autoFocus={!existing} />

      <SectionTitle>Categoria</SectionTitle>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={CATEGORY_META[c].label} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text variant="bodyStrong">Item essencial</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Quando acabar, todos são avisados e quem está na vez recebe um alerta.
          </Text>
        </View>
        <Switch value={critical} onValueChange={setCritical} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel="Item essencial" />
      </View>

      <SectionTitle>Quem compra</SectionTitle>
      <Segmented
        value={buyerMode}
        onChange={setBuyerMode}
        options={BUYER_MODES.map((m) => ({ value: m, label: m === 'ROTATION' ? 'Rodízio' : m === 'PREFERRED' ? 'Preferência' : 'Equilíbrio' }))}
      />
      <Text variant="caption" color={colors.textSecondary}>
        {MODE_HELP[buyerMode]}
      </Text>
      {buyerMode === 'PREFERRED' ? (
        <View style={styles.chips}>
          {household.data?.members.map((m) => (
            <Chip
              key={m.userId}
              label={m.userId === myId ? 'Você' : m.displayName}
              selected={(preferredUserId ?? myId) === m.userId}
              onPress={() => setPreferred(m.userId)}
              icon={<Avatar id={m.userId} name={m.displayName} size={22} />}
            />
          ))}
        </View>
      ) : null}

      <SectionTitle>Detalhes opcionais</SectionTitle>
      <TextField label="Unidade ou marca" placeholder="Ex.: pacote 12 rolos" value={unit} onChangeText={setUnit} error={errors.unit} maxLength={20} />
      <TextField
        label="Preço de referência"
        prefix="R$"
        placeholder="0,00"
        keyboardType="number-pad"
        value={price}
        onChangeText={(t) => setPrice(maskCurrency(t))}
        error={errors.typicalPriceCents}
        hint="Ajuda a estimar o valor da lista de compras."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.md },
});

import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { splitEvenly } from '@supplysync/shared';
import { useCreatePurchase, useItems } from '@/api/hooks';
import { Avatar, Banner, Button, Card, Chip, Screen, SectionTitle, Text, TextField } from '@/components/ui';
import { useHouseContext } from '@/hooks/useHouseContext';
import { apiErrorToForm } from '@/lib/forms';
import { formatCents, maskCurrency, parseCurrencyInput } from '@/lib/format';
import { colors, space } from '@/theme';

export default function NewPurchase() {
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const { myId, householdId, household, nameOf } = useHouseContext();
  const items = useItems(householdId);
  const item = itemId ? items.data?.find((i) => i.id === itemId) : undefined;
  const create = useCreatePurchase(householdId);

  const members = household.data?.members ?? [];
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  // Padrões: quem registra é quem pagou; divide com todos da casa.
  useEffect(() => {
    if (members.length && participants.length === 0) setParticipants(members.map((m) => m.userId));
  }, [members, participants.length]);
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !item?.typicalPriceCents) return;
    prefilled.current = true;
    setAmount(maskCurrency(String(item.typicalPriceCents)));
  }, [item]);

  const cents = parseCurrencyInput(amount) ?? 0;
  const payer = buyerId ?? myId;
  const preview = useMemo(() => (cents > 0 && participants.length ? splitEvenly(cents, participants) : []), [cents, participants]);

  async function save() {
    setError(null);
    setFields({});
    if (!item && !title.trim()) return setFields({ title: 'Descreva a compra' });
    if (cents <= 0) return setFields({ amountCents: 'Informe o valor' });
    try {
      await create.mutateAsync({
        itemId: item?.id ?? null,
        title: item ? null : title.trim(),
        amountCents: cents,
        participantIds: participants,
        buyerId: payer ?? undefined,
        note: note.trim() || undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      const e = apiErrorToForm(err);
      setError(e.message);
      setFields(e.fields);
    }
  }

  const toggle = (id: string) =>
    setParticipants((l) => (l.includes(id) ? (l.length > 1 ? l.filter((x) => x !== id) : l) : [...l, id]));

  return (
    <Screen
      modal
      back="close"
      title={item ? `Comprei ${item.name.toLowerCase()}` : 'Registrar compra'}
      subtitle={item ? 'O item volta para “Em dia” e a vez passa para a próxima pessoa.' : 'Para compras da casa que não estão no inventário.'}
      footer={<Button label="Registrar compra" onPress={() => void save()} loading={create.isPending} disabled={cents <= 0} />}
    >
      {error ? <Banner>{error}</Banner> : null}
      {!item ? <TextField label="O que foi comprado" placeholder="Ex.: Feira da semana" value={title} onChangeText={setTitle} error={fields.title} maxLength={60} /> : null}
      <TextField
        label="Valor pago"
        prefix="R$"
        placeholder="0,00"
        keyboardType="number-pad"
        value={amount}
        onChangeText={(t) => setAmount(maskCurrency(t))}
        error={fields.amountCents}
        autoFocus={!item?.typicalPriceCents}
      />

      <SectionTitle>Quem pagou</SectionTitle>
      <View style={styles.chips}>
        {members.map((m) => (
          <Chip
            key={m.userId}
            label={nameOf(m.userId)}
            selected={payer === m.userId}
            onPress={() => setBuyerId(m.userId)}
            icon={<Avatar id={m.userId} name={m.displayName} size={22} />}
          />
        ))}
      </View>

      <SectionTitle>Dividir entre</SectionTitle>
      <View style={styles.chips}>
        {members.map((m) => (
          <Chip key={m.userId} label={nameOf(m.userId)} selected={participants.includes(m.userId)} onPress={() => toggle(m.userId)} />
        ))}
      </View>

      {preview.length > 0 ? (
        <Card style={styles.preview}>
          <Text variant="overline" color={colors.textSecondary}>
            Divisão
          </Text>
          {preview.map((s) => (
            <View key={s.userId} style={styles.row}>
              <Text variant="label">{nameOf(s.userId)}</Text>
              <Text variant="bodyStrong">{formatCents(s.shareCents)}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <TextField label="Observação (opcional)" value={note} onChangeText={setNote} maxLength={140} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  preview: { gap: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});

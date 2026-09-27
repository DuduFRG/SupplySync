import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { idSchema, type ItemStatus } from '@supplysync/shared';
import { API_URL, authHeaders } from '@/api/client';
import { useItemEvents, useItems, useReportStatus, useUploadPhoto } from '@/api/hooks';
import { Banner, Button, Card, CategoryIcon, PressableScale, Screen, SectionTitle, StatusPill, Text, TextField } from '@/components/ui';
import { useHouseContext } from '@/hooks/useHouseContext';
import { CATEGORY_META } from '@/lib/categories';
import { apiErrorToForm } from '@/lib/forms';
import { formatCents, relativeTime } from '@/lib/format';
import { colors, radius, space, statusColors } from '@/theme';

const MODE_LABEL = { ROTATION: 'Rodízio', PREFERRED: 'Preferência', FAIR: 'Equilíbrio' } as const;

export default function ItemDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const itemId = idSchema.safeParse(params.id).success ? params.id : '';
  const { myId, householdId, nameOf } = useHouseContext();
  const items = useItems(householdId);
  const events = useItemEvents(householdId, itemId);
  const report = useReportStatus(householdId);
  const upload = useUploadPhoto(householdId);

  const item = items.data?.find((i) => i.id === itemId);
  const [choice, setChoice] = useState<ItemStatus | null>(null);
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!item) {
    return (
      <Screen modal back="close" title="Item">
        {items.isLoading ? null : <Banner>Item não encontrado. Ele pode ter sido arquivado.</Banner>}
      </Screen>
    );
  }

  const selected = choice ?? item.status;
  const changed = selected !== item.status || !!photoUri || note.trim().length > 0;

  async function pickPhoto(source: 'camera' | 'library') {
    const perm =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Você pode liberar o acesso nos ajustes do aparelho.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true, exif: false };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  async function save() {
    if (!item) return;
    setError(null);
    try {
      const photoId = photoUri ? (await upload.mutateAsync(photoUri)).id : undefined;
      await report.mutateAsync({ itemId: item.id, status: selected, note: note.trim() || undefined, photoId });
      router.back();
    } catch (err) {
      setError(apiErrorToForm(err).message);
    }
  }

  const isMyTurn = item.suggestedBuyerId === myId;

  return (
    <Screen
      modal
      back="close"
      right={
        <Button
          label="Editar"
          variant="ghost"
          size="md"
          full={false}
          icon="edit-2"
          onPress={() => router.push({ pathname: '/item/form', params: { id: item.id } })}
        />
      }
      footer={
        item.status === 'OUT' && !changed ? (
          <Button label="Comprei" icon="check" onPress={() => router.replace({ pathname: '/purchase/new', params: { itemId: item.id } })} />
        ) : (
          <Button label="Salvar sinalização" onPress={() => void save()} disabled={!changed} loading={report.isPending || upload.isPending} />
        )
      }
    >
      <View style={styles.head}>
        <CategoryIcon category={item.category} size={56} />
        <View style={styles.flex}>
          <Text variant="title">{item.name}</Text>
          <Text variant="label" color={colors.textSecondary}>
            {CATEGORY_META[item.category].label}
            {item.critical ? ' · Essencial' : ''}
            {item.unit ? ` · ${item.unit}` : ''}
          </Text>
        </View>
        <StatusPill status={item.status} />
      </View>

      {error ? <Banner>{error}</Banner> : null}

      <Card style={styles.turn}>
        <Feather name="user-check" size={20} color={colors.primary} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{isMyTurn ? 'É a sua vez de comprar' : `Vez de ${nameOf(item.suggestedBuyerId)}`}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {MODE_LABEL[item.buyerMode]}
            {item.typicalPriceCents ? ` · costuma custar ${formatCents(item.typicalPriceCents)}` : ''}
          </Text>
        </View>
      </Card>

      <SectionTitle>Como está agora?</SectionTitle>
      <View style={styles.statusRow}>
        {(['OK', 'LOW', 'OUT'] as const).map((s) => {
          const c = statusColors[s];
          const on = selected === s;
          return (
            <PressableScale
              key={s}
              haptic="selection"
              onPress={() => setChoice(s)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.statusBtn, on && { backgroundColor: c.bg, borderColor: c.dot }]}
            >
              <View style={[styles.dot, { backgroundColor: c.dot }]} />
              <Text variant="label" color={on ? c.fg : colors.text}>
                {c.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {selected !== 'OK' ? (
        <>
          <TextField label="Observação (opcional)" placeholder="Ex.: a marca de sempre, 12 rolos" value={note} onChangeText={setNote} maxLength={140} />
          {photoUri ? (
            <View>
              <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" accessibilityLabel="Foto anexada" />
              <Button label="Remover foto" variant="ghost" size="md" onPress={() => setPhotoUri(null)} />
            </View>
          ) : (
            <View style={styles.photoActions}>
              <Button label="Tirar foto" icon="camera" variant="secondary" size="md" full={false} style={styles.flex} onPress={() => void pickPhoto('camera')} />
              <Button label="Galeria" icon="image" variant="secondary" size="md" full={false} style={styles.flex} onPress={() => void pickPhoto('library')} />
            </View>
          )}
        </>
      ) : null}

      {item.lastPhotoId && !photoUri ? (
        <>
          <SectionTitle>Última foto</SectionTitle>
          <Image
            source={{ uri: `${API_URL}/v1/households/${householdId}/photos/${item.lastPhotoId}`, headers: authHeaders() }}
            style={styles.photo}
            contentFit="cover"
            accessibilityLabel={`Foto de ${item.name}`}
          />
        </>
      ) : null}

      <SectionTitle>Histórico</SectionTitle>
      {(events.data ?? []).length === 0 ? (
        <Text variant="caption" color={colors.textSecondary}>
          Nenhuma movimentação ainda.
        </Text>
      ) : (
        events.data!.map((e) => (
          <View key={e.id} style={styles.event}>
            <View style={[styles.dot, { backgroundColor: statusColors[e.status].dot }]} />
            <View style={styles.flex}>
              <Text variant="label">
                {nameOf(e.userId)} marcou “{statusColors[e.status].label}”
              </Text>
              {e.note ? (
                <Text variant="caption" color={colors.textSecondary}>
                  {e.note}
                </Text>
              ) : null}
            </View>
            <Text variant="caption" color={colors.textSecondary}>
              {relativeTime(e.createdAt)}
            </Text>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  turn: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusRow: { flexDirection: 'row', gap: space.sm },
  statusBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  photoActions: { flexDirection: 'row', gap: space.sm },
  event: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
});

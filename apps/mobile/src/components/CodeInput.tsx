import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';
import { Text } from './ui';

/** Campo de código de 6 dígitos com caixas visuais e preenchimento automático do SMS/e-mail. */
export function CodeInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: boolean }) {
  const ref = useRef<TextInput>(null);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="Código de 6 dígitos">
      <View style={styles.row}>
        {digits.map((d, i) => {
          const active = i === Math.min(value.length, 5);
          return (
            <View key={i} style={[styles.box, active && styles.boxActive, error && styles.boxError]}>
              <Text variant="title">{d.trim()}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.focus, backgroundColor: colors.primaryTint },
  boxError: { borderColor: colors.danger },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1, fontFamily: fonts.regular },
});

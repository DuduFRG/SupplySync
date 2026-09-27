import { forwardRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radius, space } from '@/theme';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  hint?: string;
  secureToggle?: boolean;
  prefix?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, secureToggle, prefix, secureTextEntry, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const borderColor = error ? colors.danger : focused ? colors.focus : colors.border;

  return (
    <View style={styles.wrap}>
      <Text variant="label" color={colors.text}>
        {label}
      </Text>
      <View style={[styles.field, { borderColor }, focused && styles.focused]}>
        {prefix ? (
          <Text variant="bodyStrong" color={colors.textSecondary}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.icon}
          selectionColor={colors.primary}
          secureTextEntry={hidden}
          maxFontSizeMultiplier={1.4}
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}
          >
            <Feather name={hidden ? 'eye' : 'eye-off'} size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.msg} accessibilityLiveRegion="polite">
          <Feather name="alert-circle" size={14} color={colors.danger} />
          <Text variant="caption" color={colors.danger} style={styles.flex}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" color={colors.textSecondary}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 54,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: radius.md,
  },
  focused: { backgroundColor: colors.primaryTint },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    paddingVertical: space.md,
    // O foco já é indicado pela borda do campo; evita o contorno duplicado do navegador.
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null),
  },
  msg: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  flex: { flex: 1 },
});

import { Text as RNText, type TextProps } from 'react-native';
import { colors, type as typeScale, type TypeVariant } from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

/** Texto do app. Respeita o tamanho de fonte do sistema até 1.4x para não quebrar layouts. */
export function Text({ variant = 'body', color = colors.text, align, style, ...rest }: AppTextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={1.4}
      style={[typeScale[variant], { color }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}

import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space } from '@/theme';
import { IconButton } from './misc';
import { Text } from './Text';

interface ScreenProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean | 'close';
  right?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Telas apresentadas como modal não precisam do inset superior completo. */
  modal?: boolean;
}

/**
 * Estrutura padrão de tela: área segura, cabeçalho consistente, conteúdo rolável
 * e rodapé fixo para a ação principal (sempre ao alcance do polegar).
 */
export function Screen({ children, title, subtitle, back, right, footer, scroll = true, refreshControl, modal }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const top = modal ? space.lg : insets.top + space.sm;

  const header =
    title || back || right ? (
      <View style={[styles.header, { paddingTop: top }]}>
        <View style={styles.headerRow}>
          {back ? (
            <IconButton
              icon={back === 'close' ? 'x' : 'arrow-left'}
              label={back === 'close' ? 'Fechar' : 'Voltar'}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          ) : (
            <View />
          )}
          {right ?? <View />}
        </View>
        {title ? (
          <View style={styles.titles}>
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text color={colors.textSecondary}>{subtitle}</Text> : null}
          </View>
        ) : null}
      </View>
    ) : (
      <View style={{ height: top }} />
    );

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: footer ? space.xl : insets.bottom + space.xxl }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.xl, gap: space.lg, paddingBottom: space.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  titles: { gap: space.xs },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.lg },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});

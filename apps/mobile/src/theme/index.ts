/**
 * Design system do SupplySync.
 * Verde suave como marca, branco como superfície, cinza escuro esverdeado como tinta.
 * Todas as combinações de texto usadas passam em WCAG AA (4.5:1) sobre seus fundos.
 */

export const palette = {
  green900: '#143D2A',
  green700: '#1F5C3F',
  green600: '#2F7A55', // primária: 5.3:1 com branco
  green500: '#3F9468',
  green300: '#9ACBB0',
  green200: '#C4E2D0',
  green100: '#DCEFE3',
  green50: '#EEF7F1',

  ink900: '#1C2420', // texto principal: 16:1 sobre branco
  ink700: '#3A4540',
  ink500: '#5B6761', // texto secundário: 5.8:1 sobre branco
  ink400: '#86918B', // somente ícones e elementos não essenciais
  ink200: '#D9DED9',
  ink100: '#ECEFEB',
  ink50: '#F7F8F5',
  white: '#FFFFFF',

  red700: '#B3261E',
  red50: '#FCEBE9',
  amber700: '#8A5A00',
  amber50: '#FDF3DC',
} as const;

export const colors = {
  background: palette.ink50,
  surface: palette.white,
  surfaceMuted: palette.ink100,
  border: palette.ink200,
  text: palette.ink900,
  textSecondary: palette.ink500,
  textInverse: palette.white,
  icon: palette.ink400,
  primary: palette.green600,
  primaryPressed: palette.green700,
  primarySoft: palette.green100,
  primaryTint: palette.green50,
  focus: palette.green500,
  danger: palette.red700,
  dangerSoft: palette.red50,
  warning: palette.amber700,
  warningSoft: palette.amber50,
  overlay: 'rgba(20, 30, 25, 0.45)',
} as const;

export const statusColors = {
  OK: { fg: palette.green700, bg: palette.green50, dot: palette.green500, label: 'Em dia' },
  LOW: { fg: palette.amber700, bg: palette.amber50, dot: '#D99A1E', label: 'Acabando' },
  OUT: { fg: palette.red700, bg: palette.red50, dot: '#D9483B', label: 'Acabou' },
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  headline: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' as const },
} as const;

export type TypeVariant = keyof typeof type;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const shadow = {
  card: {
    shadowColor: '#1C2420',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#1C2420',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

/** Área mínima de toque (Apple HIG 44pt, Material 48dp). */
export const HIT = 48;

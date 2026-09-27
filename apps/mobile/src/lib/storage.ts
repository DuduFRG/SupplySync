import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Preferências locais NÃO sensíveis (onboarding, casa ativa).
 * Credenciais nunca passam por aqui: elas ficam no SecureStore.
 */
const KEYS = {
  onboarding: 'ss.onboarding.v1',
  activeHousehold: 'ss.activeHousehold',
} as const;

export interface OnboardingAnswers {
  completedAt: string;
  /** Itens que a pessoa reconheceu como fonte de atrito em casa. */
  pains: string[];
  /** O que costuma acontecer quando algo acaba. */
  reaction: string | null;
}

export const localPrefs = {
  async getOnboarding(): Promise<OnboardingAnswers | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.onboarding);
      return raw ? (JSON.parse(raw) as OnboardingAnswers) : null;
    } catch {
      return null;
    }
  },
  setOnboarding: (answers: OnboardingAnswers) => AsyncStorage.setItem(KEYS.onboarding, JSON.stringify(answers)),
  getActiveHousehold: () => AsyncStorage.getItem(KEYS.activeHousehold),
  setActiveHousehold: (id: string) => AsyncStorage.setItem(KEYS.activeHousehold, id),
  clearActiveHousehold: () => AsyncStorage.removeItem(KEYS.activeHousehold),
};

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthTokens } from '@supplysync/shared';
import { refreshSession, request, tokenStore } from '@/api/client';
import { localPrefs, type OnboardingAnswers } from '@/lib/storage';
import { unregisterPushToken } from '@/lib/notifications';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionContextValue {
  status: Status;
  onboarding: OnboardingAnswers | null;
  activeHouseholdId: string | null;
  signIn: (tokens: AuthTokens) => Promise<void>;
  signOut: (options?: { remote?: boolean }) => Promise<void>;
  completeOnboarding: (answers: OnboardingAnswers) => Promise<void>;
  setActiveHousehold: (id: string | null) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [onboarding, setOnboarding] = useState<OnboardingAnswers | null>(null);
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);

  const clearLocalSession = useCallback(async () => {
    await tokenStore.clear();
    await localPrefs.clearActiveHousehold();
    setActiveHouseholdId(null);
    queryClient.clear();
    setStatus('signedOut');
  }, [queryClient]);

  useEffect(() => {
    tokenStore.setSessionExpiredHandler(() => void clearLocalSession());
    return () => tokenStore.setSessionExpiredHandler(null);
  }, [clearLocalSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [answers, household, restored] = await Promise.all([
        localPrefs.getOnboarding(),
        localPrefs.getActiveHousehold(),
        refreshSession(),
      ]);
      if (cancelled) return;
      setOnboarding(answers);
      setActiveHouseholdId(household);
      setStatus(restored ? 'signedIn' : 'signedOut');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (tokens: AuthTokens) => {
    await tokenStore.save(tokens);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(
    async ({ remote = true }: { remote?: boolean } = {}) => {
      if (remote) {
        await unregisterPushToken().catch(() => undefined);
        const refreshToken = await tokenStore.getRefreshToken();
        if (refreshToken) {
          await request('/v1/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(() => undefined);
        }
      }
      await clearLocalSession();
    },
    [clearLocalSession],
  );

  const completeOnboarding = useCallback(async (answers: OnboardingAnswers) => {
    await localPrefs.setOnboarding(answers);
    setOnboarding(answers);
  }, []);

  const setActiveHousehold = useCallback(async (id: string | null) => {
    if (id) await localPrefs.setActiveHousehold(id);
    else await localPrefs.clearActiveHousehold();
    setActiveHouseholdId(id);
  }, []);

  const value = useMemo(
    () => ({ status, onboarding, activeHouseholdId, signIn, signOut, completeOnboarding, setActiveHousehold }),
    [status, onboarding, activeHouseholdId, signIn, signOut, completeOnboarding, setActiveHousehold],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de SessionProvider');
  return ctx;
}

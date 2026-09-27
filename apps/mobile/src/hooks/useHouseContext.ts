import { useMemo } from 'react';
import { useActiveHouseholdId, useHousehold, useMe } from '@/api/hooks';

/** Dados comuns das telas internas: casa ativa, moradores e quem sou eu. */
export function useHouseContext() {
  const me = useMe();
  const householdId = useActiveHouseholdId();
  const household = useHousehold(householdId);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of household.data?.members ?? []) map.set(m.userId, m.displayName);
    return map;
  }, [household.data]);

  const myId = me.data?.user.id ?? null;
  const nameOf = (id: string | null | undefined) => (id ? (id === myId ? 'Você' : (names.get(id) ?? 'Ex-morador')) : 'Ninguém');

  return { me, myId, householdId, household, names, nameOf };
}

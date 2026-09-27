import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Recarrega os dados quando a tela volta a ficar visível.
 * Em uma casa compartilhada, outra pessoa pode ter sinalizado algo enquanto você estava em outra aba.
 */
export function useRefreshOnFocus(refetch: () => unknown) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}

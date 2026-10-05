"use client";

import { useCallback, useState } from "react";

/**
 * Tiny optimistic-overlay store.
 * Holds pending patches keyed by K, set synchronously before the
 * PowerSync write so UI re-renders instantly. Entries are cleared
 * once the live `useQuery` result converges (caller decides), or on
 * write failure (rollback).
 */
export function usePendingOverrides<K, V>() {
  const [map, setMap] = useState<Map<K, V>>(() => new Map());

  const set = useCallback((key: K, value: V) => {
    setMap((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
  }, []);

  const remove = useCallback((key: K) => {
    setMap((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const removeWhere = useCallback((predicate: (key: K, value: V) => boolean) => {
    setMap((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [k, v] of prev) {
        if (predicate(k, v)) {
          next.delete(k);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  return {
    overrides: map,
    setOverride: set,
    removeOverride: remove,
    removeOverridesWhere: removeWhere,
  };
}

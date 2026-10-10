"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Read/write the Horizon board URL params (?lens=, ?horizon=, ?highlight=).
 * Centralizes the "mutate a copy of the params, drop ?horizon=, replace"
 * pattern so board actions can't drift apart.
 */
export function useHorizonUrl() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      router.replace(`/horizon?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  /** Point the URL at a primary scheme key (deep links, view/lens switches). */
  const setLensParam = useCallback(
    (primary: string) => {
      updateParams((params) => {
        params.set("lens", primary);
        params.delete("horizon");
      });
    },
    [updateParams],
  );

  return {
    searchParams,
    router,
    updateParams,
    setLensParam,
    lensParam: searchParams.get("lens"),
    horizonParam: searchParams.get("horizon"),
    highlightId: searchParams.get("highlight"),
  };
}

export type UseHorizonUrlResult = ReturnType<typeof useHorizonUrl>;

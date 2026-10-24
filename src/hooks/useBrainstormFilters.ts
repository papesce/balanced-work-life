"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEYS, writeJson, writeRawString } from "@/lib/storage";
import {
  DEFAULT_BRAINSTORM_FILTERS,
  countActiveBrainstormFilters,
  loadBrainstormFilters,
  type BrainstormFilters,
} from "@/lib/brainstormFilters";
import type { IdeaType } from "@/lib/types";
import type { IdeasScope } from "@/hooks/useIdeas";

export type { BrainstormFilters };

export function useBrainstormFilters() {
  const [filters, setFilters] = useState<BrainstormFilters>(() => loadBrainstormFilters());

  useEffect(() => {
    writeJson(STORAGE_KEYS.brainstormFilters, filters);
    // Keep legacy key in sync until it is removed.
    writeRawString(STORAGE_KEYS.brainstormHideInHorizon, String(filters.hideInHorizon));
  }, [filters]);

  const patch = (p: Partial<BrainstormFilters>) => setFilters((prev) => ({ ...prev, ...p }));
  const setTypeFilter = (v: IdeaType[] | ((prev: IdeaType[]) => IdeaType[])) =>
    setFilters((prev) => ({
      ...prev,
      typeFilter: typeof v === "function" ? v(prev.typeFilter) : v,
    }));
  const setTimeScope = (timeScope: IdeasScope) => patch({ timeScope });
  const resetFilters = () => setFilters(DEFAULT_BRAINSTORM_FILTERS);

  return {
    filters,
    ...filters,
    setFilters: patch,
    setShowType: (showType: boolean) => patch({ showType }),
    setShowArea: (showArea: boolean) => patch({ showArea }),
    setShowToday: (showToday: boolean) => patch({ showToday }),
    setHideClosed: (hideClosed: boolean) => patch({ hideClosed }),
    setHideCompleted: (hideCompleted: boolean) => patch({ hideCompleted }),
    setHideDeferred: (hideDeferred: boolean) => patch({ hideDeferred }),
    setHideInHorizon: (hideInHorizon: boolean) => patch({ hideInHorizon }),
    setTypeFilter,
    setGroupUnassociatedPaths: (groupUnassociatedPaths: boolean) =>
      patch({ groupUnassociatedPaths }),
    setTimeScope,
    resetFilters,
    activeFilterCount: countActiveBrainstormFilters(filters),
  };
}

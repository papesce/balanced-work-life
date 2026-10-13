"use client";

import { useCallback, useMemo } from "react";
import { groupKeyOf } from "@/components/lens";
import type { LensColumn } from "@/components/lens";
import { groupSecondaryByLens, groupTreesByLens } from "@/lib/horizonGrouping";
import { filterTreeByType } from "@/lib/ideaTreeFilters";
import type { PriorityValue } from "@/components/shared/PriorityChip";
import type { IdeaNode, IdeaType } from "@/lib/types";

interface UseHorizonGroupingParams {
  allTreeNodes: IdeaNode[];
  columns: LensColumn[];
  typeFilter: IdeaType[];
  valueOf: (ideaId: string) => string | null;
  valuesBySchemeKey: Map<string, Map<string, string>>;
  secondaryKeyOf: (groupKey: string | null) => string | null;
  schemeByKey: Map<string, { id: string }>;
  optionsBySchemeId: Map<string, { value: string; label: string }[]>;
}

/**
 * Horizon grouping pipeline (memo-only): primary grouping by lens,
 * type filtering, then per-column secondary-split promotion.
 * Filtered-out children never promote.
 */
export function useHorizonGrouping({
  allTreeNodes,
  columns,
  typeFilter,
  valueOf,
  valuesBySchemeKey,
  secondaryKeyOf,
  schemeByKey,
  optionsBySchemeId,
}: UseHorizonGroupingParams) {
  const priorityOf = useCallback(
    (ideaId: string): PriorityValue =>
      (valuesBySchemeKey.get("priority")?.get(ideaId) ?? null) as PriorityValue,
    [valuesBySchemeKey],
  );

  const { grouped: treesByLens, promotedByParent } = useMemo(
    () => groupTreesByLens(allTreeNodes, valueOf),
    [allTreeNodes, valueOf],
  );

  const columnLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of columns) map.set(groupKeyOf(c.key), c.label);
    return map;
  }, [columns]);

  const filteredTreesByLens = useMemo(() => {
    let result = treesByLens;
    if (typeFilter.length > 0) {
      const typed: Record<string, IdeaNode[]> = {};
      for (const key of Object.keys(result)) {
        typed[key] = filterTreeByType(result[key], typeFilter);
      }
      result = typed;
    }
    return result;
  }, [treesByLens, typeFilter]);

  /**
   * Secondary-split promotion, per primary column. Runs after primary
   * grouping + filters so filtered-out children never promote. Skipped when
   * the column has no Split lens.
   */
  const secondaryByPrimary = useMemo(() => {
    const out: Record<
      string,
      {
        secKey: string;
        grouped: Map<string | null, IdeaNode[]>;
        promoted: Map<string, { id: string; columnKey: string }[]>;
        labelByValue: Map<string, string>;
      }
    > = {};
    for (const col of columns) {
      const primaryGroupKey = groupKeyOf(col.key);
      const secKey = secondaryKeyOf(col.key);
      if (!secKey) continue;
      const secMap = valuesBySchemeKey.get(secKey);
      const secondaryOf = (ideaId: string): string | null => secMap?.get(ideaId) ?? null;
      const pseudoRoots = filteredTreesByLens[primaryGroupKey] ?? [];
      const { grouped, promotedByParent: promoted } = groupSecondaryByLens(
        pseudoRoots,
        secondaryOf,
      );
      const scheme = schemeByKey.get(secKey);
      const labelByValue = new Map<string, string>();
      if (scheme) {
        for (const o of optionsBySchemeId.get(scheme.id) ?? []) labelByValue.set(o.value, o.label);
      }
      out[primaryGroupKey] = { secKey, grouped, promoted, labelByValue };
    }
    return out;
  }, [
    columns,
    secondaryKeyOf,
    valuesBySchemeKey,
    filteredTreesByLens,
    schemeByKey,
    optionsBySchemeId,
  ]);

  return {
    priorityOf,
    treesByLens,
    promotedByParent,
    columnLabelByKey,
    filteredTreesByLens,
    secondaryByPrimary,
  };
}

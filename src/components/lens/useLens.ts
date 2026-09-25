"use client";

import { useCallback, useMemo } from "react";
import type { ClassificationOption, ClassificationScheme, IdeaClassification } from "@/lib/types";
import { LensColumn, buildValuesBySchemeKey, optionsForScheme } from "@/components/lens/lensUtils";

/**
 * Non-classification lens (e.g. area from first tag, priority flag).
 * Lets a LensBoard mix scheme lenses with computed lenses.
 */
export interface CustomLensDef {
  options: { value: string; label: string }[];
  valueOf: (ideaId: string) => string | null;
}

interface UseLensParams {
  schemes: ClassificationScheme[];
  classificationOptions: ClassificationOption[];
  classifications: IdeaClassification[];
  lensKey: string;
  /** Computed lenses keyed by lens key. Memoize in the caller. */
  customs?: Record<string, CustomLensDef>;
}

const EMPTY_MAP = new Map<string, string>();

/**
 * Shared lens-board grouping: columns + per-idea value lookup.
 * Horizon uses it with schemes only; Projects adds area/priority customs.
 */
export function useLens({
  schemes,
  classificationOptions,
  classifications,
  lensKey,
  customs,
}: UseLensParams) {
  const valuesBySchemeKey = useMemo(
    () => buildValuesBySchemeKey(schemes, classificationOptions, classifications),
    [schemes, classificationOptions, classifications],
  );

  const schemeByKey = useMemo(() => new Map(schemes.map((s) => [s.key, s])), [schemes]);

  /** Active lens scheme; unknown keys fall back to Term. */
  const activeScheme = useMemo(
    () => schemes.find((s) => s.key === lensKey) ?? schemes.find((s) => s.key === "term") ?? null,
    [schemes, lensKey],
  );

  const optionsBySchemeId = useMemo(() => {
    const map = new Map<string, { value: string; label: string }[]>();
    for (const o of classificationOptions) {
      const list = map.get(o.scheme_id) ?? [];
      list.push({ value: o.value, label: o.label });
      map.set(o.scheme_id, list);
    }
    // classificationOptions arrive ordered by sort_order from the hook query.
    return map;
  }, [classificationOptions]);

  const custom = customs?.[lensKey];

  const columns: LensColumn[] = useMemo(() => {
    if (custom) return [...custom.options.map((o) => ({ key: o.value, label: o.label }))];
    if (!activeScheme) return [];
    return [
      ...optionsForScheme(classificationOptions, activeScheme.id).map((o) => ({
        key: o.value as string,
        label: o.label,
      })),
      { key: null, label: "Unclassified" },
    ];
  }, [custom, activeScheme, classificationOptions]);

  const valueById = useMemo(
    () => valuesBySchemeKey.get(activeScheme?.key ?? "") ?? EMPTY_MAP,
    [valuesBySchemeKey, activeScheme],
  );

  const valueOf = useCallback(
    (ideaId: string): string | null => {
      if (custom) return custom.valueOf(ideaId);
      return valueById.get(ideaId) ?? null;
    },
    [custom, valueById],
  );

  return {
    valuesBySchemeKey,
    schemeByKey,
    activeScheme,
    optionsBySchemeId,
    columns,
    valueOf,
  };
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClassificationOption, ClassificationScheme, IdeaClassification } from "@/lib/types";
import type { SecondaryLensMap } from "@/lib/storage";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import { useLens } from "@/components/lens";
import { optionsForScheme } from "@/components/lens/lensUtils";
import { orderTrail } from "@/components/lens/lensUtils";
import {
  DEFAULT_LENSES,
  buildLensColumns,
  primarySchemeForKey,
  type HorizonLensDef,
} from "@/lib/horizonLenses";
import { applyViewToSecondaryMap, type HorizonView } from "@/lib/horizonViews";
import type { UseHorizonPrefsResult } from "@/hooks/useHorizonPrefs";

interface UseHorizonSelectionParams {
  views: HorizonView[];
  dbDefaultViewId: string | null;
  dbDefaultLensId: string | null;
  dbSecondaryMap: SecondaryLensMap;
  prefs: Pick<UseHorizonPrefsResult, "setSecondaryMap" | "deleteView" | "setDefault">;
  schemes: ClassificationScheme[];
  classificationOptions: ClassificationOption[];
  classifications: IdeaClassification[];
  lensParam: string | null;
  setLensParam: (primary: string) => void;
}

/**
 * Owns the Horizon board's active lens/view/split selection: local
 * state + uiPrefsStore persistence + ?lens= URL sync + the resolved lens
 * (columns, value lookups). Saved-view defaults and the synced secondary
 * map come from useHorizonPrefs; the edit session lives in
 * useHorizonLensSession and drives this hook's setters.
 */
export function useHorizonSelection({
  views,
  dbDefaultViewId,
  dbDefaultLensId,
  dbSecondaryMap,
  prefs,
  schemes,
  classificationOptions,
  classifications,
  lensParam,
  setLensParam,
}: UseHorizonSelectionParams) {
  const prefsLens = useUiPrefsStore((s) => s.horizonLens);
  const setPrefs = useUiPrefsStore((s) => s.set);

  // Startup ignores local active selection ("forget local"): an explicit
  // ?lens= link wins, otherwise the synced default view (if any).
  const initialDefaultView = !lensParam
    ? (views.find((v) => v.id === dbDefaultViewId) ?? null)
    : null;
  const [activeViewId, setActiveViewId] = useState<string | null>(
    () => initialDefaultView?.id ?? null,
  );
  const [defaultViewId, setDefaultViewId] = useState<string | null>(() => dbDefaultViewId);
  const [defaultLensId, setDefaultLensId] = useState<string | null>(() => dbDefaultLensId);
  const [lensKey, setLensKey] = useState<string>(() => {
    if (lensParam) return primarySchemeForKey(lensParam, new Set(schemes.map((s) => s.key)));
    if (initialDefaultView) return initialDefaultView.primary;
    const defLens = DEFAULT_LENSES.find((l) => l.id === dbDefaultLensId) ?? null;
    if (defLens) return defLens.primaryScheme;
    return prefsLens ?? "term";
  });

  const [secondaryMap, setSecondaryMapState] = useState<SecondaryLensMap>(() =>
    initialDefaultView
      ? applyViewToSecondaryMap(initialDefaultView, dbSecondaryMap)
      : dbSecondaryMap,
  );
  /** Built-in lenses with user-edited names/descriptions overlaid from the
   *  seeded rows (matched by primary scheme). Selection stays id-based.
   *  orderTrail is the read-only primary column order ("A → B → C"). */
  const displayLenses = useMemo(
    () =>
      DEFAULT_LENSES.map((l) => {
        const override = views.find((v) => v.is_builtin && v.primary === l.primaryScheme);
        const schemeOptions = optionsForScheme(
          classificationOptions,
          schemes.find((s) => s.key === l.primaryScheme)?.id ?? "",
        );
        const cols = buildLensColumns(l, schemeOptions);
        return {
          id: l.id,
          name: override?.name ?? l.name,
          description: override?.description ?? l.description,
          primaryScheme: l.primaryScheme,
          orderTrail: orderTrail(cols.filter((c) => c.key !== null).map((c) => c.label)),
        };
      }),
    [views, schemes, classificationOptions],
  );

  /** Active lens scheme; unknown keys fall back to Term. */
  const {
    valuesBySchemeKey,
    schemeByKey,
    activeScheme,
    optionsBySchemeId,
    columns,
    valueOf,
    lens,
    lensSynthesized,
  } = useLens({ schemes, classificationOptions, classifications, lensKey });

  const secondaryKeyOf = useCallback(
    (primaryValue: string | null): string | null => {
      if (primaryValue == null || !activeScheme) return null;
      const raw = secondaryMap[activeScheme.key]?.[primaryValue];
      // Explicit "None" (null) sticks; an unset column falls back to the
      // built-in lens default splits when a built-in lens is active
      // (a saved view or synthesized lens gets no defaults).
      const candidate =
        raw !== undefined
          ? raw
          : activeViewId == null && !lensSynthesized
            ? (lens.defaultSplits[primaryValue] ?? null)
            : null;
      if (!candidate || candidate === activeScheme.key || !schemeByKey.has(candidate)) return null;
      return candidate;
    },
    [secondaryMap, activeScheme, schemeByKey, activeViewId, lensSynthesized, lens],
  );

  const secondaryValueOf = useCallback(
    (secondaryKey: string | null) =>
      (ideaId: string): string | null => {
        if (!secondaryKey) return null;
        return valuesBySchemeKey.get(secondaryKey)?.get(ideaId) ?? null;
      },
    [valuesBySchemeKey],
  );

  /** Replace the whole secondary map, persisting the synced copy. */
  const replaceSecondaryMap = useCallback(
    (next: SecondaryLensMap) => {
      setSecondaryMapState(next);
      void prefs.setSecondaryMap(next);
    },
    [prefs],
  );

  /** Functional secondary-map update, persisting the synced copy. */
  const mergeSecondaryMap = useCallback(
    (fn: (prev: SecondaryLensMap) => SecondaryLensMap) => {
      setSecondaryMapState((prev) => {
        const next = fn(prev);
        void prefs.setSecondaryMap(next);
        return next;
      });
    },
    [prefs],
  );

  /** Set the lens key, persisting the local active selection. */
  const persistLensKey = useCallback(
    (key: string) => {
      setLensKey(key);
      setPrefs({ horizonLens: key });
    },
    [setPrefs],
  );

  const selectView = useCallback(
    (id: string) => {
      const view = views.find((v) => v.id === id);
      if (!view) return;
      mergeSecondaryMap((prev) => applyViewToSecondaryMap(view, prev));
      setActiveViewId(id);
      setPrefs({ horizonActiveViewId: id, horizonLensId: null });
      persistLensKey(view.primary);
      setLensParam(view.primary);
    },
    [views, mergeSecondaryMap, setPrefs, persistLensKey, setLensParam],
  );

  const selectLens = useCallback(
    (next: HorizonLensDef) => {
      setLensKey(next.primaryScheme);
      setPrefs({
        horizonLens: next.primaryScheme,
        horizonLensId: next.id,
        horizonActiveViewId: null,
      });
      setActiveViewId(null);
      setLensParam(next.primaryScheme);
    },
    [setPrefs, setLensParam],
  );

  const deleteView = useCallback(
    (id: string) => {
      void prefs.deleteView(id);
      if (id === activeViewId) {
        setActiveViewId(null);
        setPrefs({ horizonActiveViewId: null });
      }
      if (id === defaultViewId) {
        setDefaultViewId(null);
      }
    },
    [activeViewId, defaultViewId, prefs, setPrefs],
  );

  const toggleDefaultView = useCallback(
    (id: string) => {
      const next = id === defaultViewId ? null : id;
      setDefaultViewId(next);
      // The two stars are mutually exclusive (single-statement setDefault).
      setDefaultLensId(null);
      void prefs.setDefault(next ? { viewId: next } : {});
    },
    [defaultViewId, prefs],
  );

  const toggleDefaultLens = useCallback(
    (id: string) => {
      const next = id === defaultLensId ? null : id;
      setDefaultLensId(next);
      setDefaultViewId(null);
      void prefs.setDefault(next ? { lensId: next } : {});
    },
    [defaultLensId, prefs],
  );

  // Sync lens from ?lens= (deep links, global search). Accepts both scheme
  // keys and built-in lens ids; the URL keeps carrying the scheme key.
  useEffect(() => {
    if (!lensParam || schemes.length === 0) return;
    const primary = primarySchemeForKey(lensParam, new Set(schemes.map((s) => s.key)));
    if (primary !== lensKey && schemes.some((s) => s.key === primary)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync lens from URL param
      setLensKey(primary);
    }
  }, [lensParam, lensKey, schemes]);

  const activeView = views.find((v) => v.id === activeViewId) ?? null;
  const activeDisplayLens =
    !activeView && !lensSynthesized ? (displayLenses.find((l) => l.id === lens.id) ?? null) : null;

  return {
    lensKey,
    setLensKey,
    persistLensKey,
    activeViewId,
    setActiveViewId,
    secondaryMap,
    replaceSecondaryMap,
    mergeSecondaryMap,
    defaultViewId,
    defaultLensId,
    setPrefs,
    valuesBySchemeKey,
    schemeByKey,
    activeScheme,
    optionsBySchemeId,
    columns,
    valueOf,
    lens,
    lensSynthesized,
    secondaryKeyOf,
    secondaryValueOf,
    displayLenses,
    activeView,
    activeDisplayLens,
    selectView,
    selectLens,
    deleteView,
    toggleDefaultView,
    toggleDefaultLens,
  };
}

export type UseHorizonSelectionResult = ReturnType<typeof useHorizonSelection>;

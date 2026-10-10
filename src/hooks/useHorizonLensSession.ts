"use client";

import { useCallback, useMemo, useState } from "react";
import type { ClassificationScheme } from "@/lib/types";
import type { SecondaryLensMap } from "@/lib/storage";
import {
  applyViewToSecondaryMap,
  newHorizonViewId,
  snapshotSplits,
  viewColumnKey,
  type HorizonView,
} from "@/lib/horizonViews";
import { DEFAULT_LENSES } from "@/lib/horizonLenses";
import type { UseHorizonPrefsResult } from "@/hooks/useHorizonPrefs";
import type { UseHorizonSelectionResult } from "@/hooks/useHorizonSelection";

interface UseHorizonLensSessionParams {
  selection: UseHorizonSelectionResult;
  views: HorizonView[];
  prefs: Pick<UseHorizonPrefsResult, "saveView" | "deleteView">;
  schemes: ClassificationScheme[];
  setLensParam: (primary: string) => void;
  updateParams: (mutate: (params: URLSearchParams) => void) => void;
}

/**
 * Below-header lens edit session. The edit icon on a lens row opens an
 * editor panel below the header (name, description, primary). Per-column
 * splits edit directly on each primary box header. Changes apply live on
 * the board; Save persists them, Cancel restores the snapshot taken when
 * the session started.
 */
export function useHorizonLensSession({
  selection,
  views,
  prefs,
  schemes,
  setLensParam,
  updateParams,
}: UseHorizonLensSessionParams) {
  const {
    lensKey,
    persistLensKey,
    activeViewId,
    setActiveViewId,
    secondaryMap,
    replaceSecondaryMap,
    mergeSecondaryMap,
    setPrefs,
    columns,
    secondaryKeyOf,
    activeScheme,
    lens,
    lensSynthesized,
    displayLenses,
  } = selection;

  const [menuEditingId, setMenuEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [nameAutoFocus, setNameAutoFocus] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<{
    lensKey: string;
    secondaryMapJson: string;
    name: string;
    description: string;
    activeViewId: string | null;
  } | null>(null);

  /** Group-by options for the edit panel: default lenses by lens name
   *  with the scheme label in parentheses (matching the per-column Split
   *  dropdowns, which list raw scheme labels), then schemes without a
   *  default lens (synthesized) by scheme label. */
  const primaryOptions = useMemo(() => {
    const orderedSchemes = [...schemes].sort((a, b) => a.sort_order - b.sort_order);
    const lensed = new Set(displayLenses.map((l) => l.primaryScheme));
    const labelByKey = new Map(orderedSchemes.map((s) => [s.key, s.label]));
    return [
      ...displayLenses.map((l) => {
        const schemeLabel = labelByKey.get(l.primaryScheme);
        return {
          value: l.primaryScheme,
          label: schemeLabel && schemeLabel !== l.name ? `${l.name} (${schemeLabel})` : l.name,
        };
      }),
      ...orderedSchemes
        .filter((s) => !lensed.has(s.key))
        .map((s) => ({ value: s.key, label: s.label })),
    ];
  }, [displayLenses, schemes]);

  /** The saved view under edit, if the session targets one (built-in lenses
   *  are id-addressed and keep their grouping fixed). */
  const editingTargetView =
    menuEditingId != null
      ? (views.find((v) => v.id === menuEditingId && !v.is_builtin) ?? null)
      : null;
  const primaryLocked = menuEditingId == null || editingTargetView == null;

  const hasUnsavedEdits = useMemo(() => {
    if (menuEditingId == null || !editSnapshot) return false;
    if (draftName.trim() !== editSnapshot.name) return true;
    if (draftDescription !== editSnapshot.description) return true;
    if (lensKey !== editSnapshot.lensKey) return true;
    if ((activeViewId ?? null) !== editSnapshot.activeViewId) return true;
    return JSON.stringify(secondaryMap) !== editSnapshot.secondaryMapJson;
  }, [
    menuEditingId,
    editSnapshot,
    draftName,
    draftDescription,
    lensKey,
    activeViewId,
    secondaryMap,
  ]);

  /** Leave the edit session, restoring the snapshot. Returns false when the
   *  user backs out of the discard confirm, so callers can abort. */
  const leaveEditSession = useCallback(() => {
    if (menuEditingId == null) return true;
    if (hasUnsavedEdits) {
      const discard = window.confirm("Discard your unsaved lens changes and leave the editor?");
      if (!discard) return false;
    }
    if (editSnapshot) {
      persistLensKey(editSnapshot.lensKey);
      try {
        replaceSecondaryMap(JSON.parse(editSnapshot.secondaryMapJson) as SecondaryLensMap);
      } catch {
        // Corrupt snapshot (shouldn't happen): keep the live map.
      }
      setActiveViewId(editSnapshot.activeViewId);
      setPrefs({
        horizonActiveViewId: editSnapshot.activeViewId,
        horizonLensId: editSnapshot.activeViewId ? null : undefined,
      });
      setLensParam(editSnapshot.lensKey);
      // An abandoned empty slot (never named) is removed again.
      if (editSnapshot.name === "") {
        const stale = views.find((v) => v.id === menuEditingId && !v.is_builtin);
        if (stale && stale.name === "Untitled lens") void prefs.deleteView(stale.id);
      }
    }
    setMenuEditingId(null);
    setEditSnapshot(null);
    setNameAutoFocus(false);
    return true;
  }, [
    menuEditingId,
    hasUnsavedEdits,
    editSnapshot,
    views,
    setPrefs,
    persistLensKey,
    replaceSecondaryMap,
    setActiveViewId,
    setLensParam,
    prefs,
  ]);

  /** Start a below-header edit session for a lens row (built-in id or
   *  view id). The lens is activated first so criteria changes preview
   *  live. An in-progress session is left (with confirm) first. */
  const startMenuEdit = useCallback(
    (id: string) => {
      if (!leaveEditSession()) return;
      const view = views.find((v) => v.id === id && !v.is_builtin) ?? null;
      if (view) {
        const merged = applyViewToSecondaryMap(view, secondaryMap);
        replaceSecondaryMap(merged);
        setActiveViewId(id);
        setPrefs({ horizonActiveViewId: id, horizonLensId: null });
        persistLensKey(view.primary);
        setDraftName(view.name);
        setDraftDescription(view.description);
        setEditSnapshot({
          lensKey: view.primary,
          secondaryMapJson: JSON.stringify(merged),
          name: view.name.trim(),
          description: view.description,
          activeViewId: id,
        });
      } else {
        const def =
          DEFAULT_LENSES.find((l) => l.id === id) ??
          DEFAULT_LENSES.find((l) => l.primaryScheme === id) ??
          null;
        if (!def) return;
        persistLensKey(def.primaryScheme);
        setPrefs({
          horizonLensId: def.id,
          horizonActiveViewId: null,
        });
        setActiveViewId(null);
        const override = views.find((v) => v.is_builtin && v.primary === def.primaryScheme);
        const name = override?.name ?? def.name;
        const description = override?.description ?? def.description ?? "";
        setDraftName(name);
        setDraftDescription(description);
        setEditSnapshot({
          lensKey: def.primaryScheme,
          secondaryMapJson: JSON.stringify(secondaryMap),
          name: name.trim(),
          description,
          activeViewId: null,
        });
      }
      updateParams((params) => {
        params.delete("horizon");
      });
      setMenuEditingId(id);
      setNameAutoFocus(true);
    },
    [
      views,
      secondaryMap,
      replaceSecondaryMap,
      setActiveViewId,
      setPrefs,
      persistLensKey,
      updateParams,
      leaveEditSession,
    ],
  );

  /** Create lens: an empty slot (untitled row) selected at once, with the
   *  name input focused so the user names it right away. */
  const createLens = useCallback(() => {
    if (!leaveEditSession()) return;
    const created: HorizonView = {
      id: newHorizonViewId(),
      name: "Untitled lens",
      description: "",
      primary: lensKey,
      column_order: [],
      splits: snapshotSplits(
        columns.map((c) => c.key),
        secondaryKeyOf,
      ),
      is_builtin: false,
    };
    void prefs.saveView(created);
    setActiveViewId(created.id);
    setPrefs({ horizonActiveViewId: created.id, horizonLensId: null });
    // Empty name draft = the "empty slot": Save stays disabled until named.
    setDraftName("");
    setDraftDescription("");
    setEditSnapshot({
      lensKey,
      secondaryMapJson: JSON.stringify(secondaryMap),
      name: "",
      description: "",
      activeViewId: created.id,
    });
    setMenuEditingId(created.id);
    setNameAutoFocus(true);
  }, [
    lensKey,
    secondaryMap,
    columns,
    secondaryKeyOf,
    prefs,
    setActiveViewId,
    setPrefs,
    leaveEditSession,
  ]);

  const saveLensEdits = useCallback(() => {
    if (menuEditingId == null) return;
    const trimmed = draftName.trim();
    if (!trimmed) return;
    const splits = snapshotSplits(
      columns.map((c) => c.key),
      secondaryKeyOf,
    );
    const target = views.find((v) => v.id === menuEditingId && !v.is_builtin) ?? null;
    if (target) {
      const updated: HorizonView = {
        ...target,
        name: trimmed,
        description: draftDescription,
        primary: lensKey,
        splits,
      };
      void prefs.saveView(updated);
      setActiveViewId(updated.id);
      setPrefs({ horizonActiveViewId: updated.id, horizonLensId: null });
    } else {
      const builtin =
        DEFAULT_LENSES.find((l) => l.id === menuEditingId) ??
        (!lensSynthesized ? (DEFAULT_LENSES.find((l) => l.id === lens.id) ?? null) : null);
      const seeded =
        builtin?.primaryScheme === lensKey
          ? (views.find((v) => v.is_builtin && v.primary === builtin.primaryScheme) ?? null)
          : null;
      if (seeded) {
        const updated: HorizonView = {
          ...seeded,
          name: trimmed,
          description: draftDescription,
          splits,
        };
        void prefs.saveView(updated);
      } else {
        // Synthesized scheme lens: fork into a new saved lens so
        // id-addressed built-ins keep their grouping.
        const created: HorizonView = {
          id: newHorizonViewId(),
          name: trimmed,
          description: draftDescription,
          primary: lensKey,
          column_order: [],
          splits,
          is_builtin: false,
        };
        void prefs.saveView(created);
        setActiveViewId(created.id);
        setPrefs({ horizonActiveViewId: created.id, horizonLensId: null });
      }
    }
    setLensParam(lensKey);
    setMenuEditingId(null);
    setEditSnapshot(null);
    setNameAutoFocus(false);
  }, [
    menuEditingId,
    draftName,
    draftDescription,
    columns,
    secondaryKeyOf,
    lensKey,
    views,
    lensSynthesized,
    lens,
    prefs,
    setActiveViewId,
    setPrefs,
    setLensParam,
  ]);

  const primaryChangeLive = useCallback(
    (scheme: string) => {
      if (menuEditingId == null || primaryLocked) return;
      persistLensKey(scheme);
      // Detach from the saved view: the board no longer matches it.
      setActiveViewId(null);
      setPrefs({ horizonActiveViewId: null });
      setLensParam(scheme);
    },
    [menuEditingId, primaryLocked, persistLensKey, setActiveViewId, setPrefs, setLensParam],
  );

  const splitChangeLive = useCallback(
    (colKey: string | null, value: string | null) => {
      if (menuEditingId == null || !activeScheme || colKey == null) return;
      const primaryKey = activeScheme.key;
      const groupKey = viewColumnKey(colKey);
      mergeSecondaryMap((prev) => ({
        ...prev,
        [primaryKey]: { ...(prev[primaryKey] ?? {}), [groupKey]: value },
      }));
    },
    [menuEditingId, activeScheme, mergeSecondaryMap],
  );

  return {
    menuEditingId,
    draftName,
    setDraftName,
    draftDescription,
    setDraftDescription,
    nameAutoFocus,
    primaryOptions,
    primaryLocked,
    hasUnsavedEdits,
    leaveEditSession,
    startMenuEdit,
    createLens,
    saveLensEdits,
    primaryChangeLive,
    splitChangeLive,
  };
}

export type UseHorizonLensSessionResult = ReturnType<typeof useHorizonLensSession>;

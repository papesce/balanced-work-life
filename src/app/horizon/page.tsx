"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, EyeOff, Tag } from "lucide-react";
import { useIdeas, type CreateIdeaPosition } from "@/hooks/useIdeas";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useUndoAction } from "@/lib/tasks/undo";
import { filterTreeByType } from "@/lib/ideaTreeFilters";
import { getFocusedSubtreeIds } from "@/lib/ideaTreeFocus";
import { buildTree as buildTreeGeneric } from "@/components/tree/buildTree";
import { AppShell } from "@/components/AppShell";
import { UndoBar } from "@/components/shared/UndoBar";
import { QuickAddInput } from "@/components/timeline/QuickAddInput";
import { HorizonTree } from "@/components/horizon/HorizonTree";
import { HorizonViewSwitcher } from "@/components/horizon/HorizonViewSwitcher";
import { LensEditPanel } from "@/components/horizon/LensEditPanel";
import { type PriorityValue } from "@/components/shared/PriorityChip";
import { TypePicker } from "@/components/brainstorm/TypePicker";
import { TypeFilterPicker } from "@/components/shared/TypeFilterPicker";
import { Idea, IdeaNode, IdeaType } from "@/lib/types";
import { TYPE_BADGE } from "@/lib/constants";
import { useClassifications } from "@/hooks/useClassifications";
import { useHorizonPrefs, type UseHorizonPrefsResult } from "@/hooks/useHorizonPrefs";
import {
  STORAGE_KEYS,
  type SecondaryLensMap,
  type TreeOverrideState,
  readTreeOverrides,
  writeTreeOverrides,
} from "@/lib/storage";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";

import { useLens, ColumnShell, UNCLASSIFIED, groupKeyOf, type LensColumn } from "@/components/lens";
import { groupTreesByLens, groupSecondaryByLens } from "@/lib/horizonGrouping";
import { getHiddenProjectIds } from "@/lib/horizonProjectVisibility";
import {
  applyViewToSecondaryMap,
  newHorizonViewId,
  snapshotSplits,
  viewColumnKey,
  type HorizonView,
} from "@/lib/horizonViews";
import { DEFAULT_LENSES, buildLensComparator, type HorizonLensDef } from "@/lib/horizonLenses";

const ACTIVE_STATUSES = new Set(["draft", "planned", "in_progress", "scheduled"]);

function buildFilteredTree(
  ideas: Idea[],
  collapsedIds: Set<string>,
  hideClosed: boolean,
  hideProjectsWithTasks: boolean,
): IdeaNode[] {
  let pool = hideClosed ? ideas.filter((i) => ACTIVE_STATUSES.has(i.status)) : ideas;
  if (hideProjectsWithTasks) {
    const hidden = getHiddenProjectIds(pool, ideas);
    if (hidden.size > 0) pool = pool.filter((i) => !hidden.has(i.id));
  }

  const poolIds = new Set(pool.map((i) => i.id));
  const childIds = new Set(
    pool.filter((i) => i.parent_id && poolIds.has(i.parent_id)).map((i) => i.id),
  );
  // Every root is in scope: classified roots group by value under the
  // active lens, the rest form the explicit unclassified group
  // (never hidden, never defaulted).
  const rootIds = pool.filter((i) => !childIds.has(i.id)).map((i) => i.id);
  const rootSet = new Set(rootIds);

  const included = pool.filter((i) => {
    if (rootSet.has(i.id)) return true;
    let cur = i;
    while (cur.parent_id && poolIds.has(cur.parent_id)) {
      cur = ideas.find((p) => p.id === cur.parent_id)!;
      if (rootSet.has(cur.id)) return true;
    }
    return false;
  });

  return buildTreeGeneric(included, collapsedIds, compareIdeasForTree);
}

function compareIdeasForTree(a: Idea, b: Idea): number {
  const aDone = a.completed_at ? 1 : 0;
  const bDone = b.completed_at ? 1 : 0;
  if (aDone !== bDone) return aDone - bDone;
  return a.sort_order - b.sort_order;
}

/**
 * Normalize a ?lens= value (or stored key) to a primary scheme key: scheme
 * keys pass through, built-in lens ids map to their primary scheme, unknown
 * values pass through for the Term fallback in useLens.
 */
function primarySchemeForKey(key: string, schemeKeys: Set<string>): string {
  if (schemeKeys.has(key)) return key;
  return DEFAULT_LENSES.find((l) => l.id === key)?.primaryScheme ?? key;
}

function RootAddInput({
  label,
  onAdd,
  suggestFrom,
}: {
  label: string;
  onAdd: (text: string, type?: IdeaType) => Promise<void>;
  suggestFrom?: Idea[];
}) {
  const [rootType, setRootType] = useState<IdeaType>("task");
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [typePickerPos, setTypePickerPos] = useState<{ top: number; left: number } | null>(null);
  const badge = TYPE_BADGE[rootType];

  return (
    <div className="border-t border-black/[0.02] px-4 py-2 dark:border-white/[0.02]">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTypePickerPos({ top: rect.bottom + 4, left: rect.left });
              setShowTypePicker(!showTypePicker);
            }}
            className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${badge.className} cursor-pointer transition-opacity hover:opacity-80`}
          >
            {badge.label}
          </button>
          {showTypePicker && typePickerPos && (
            <TypePicker
              current={rootType}
              onSelect={(type) => {
                setRootType(type ?? "task");
                setShowTypePicker(false);
              }}
              onClose={() => setShowTypePicker(false)}
              position={typePickerPos}
            />
          )}
        </div>
        <QuickAddInput
          placeholder={`+ Add to ${label}...`}
          onAdd={async (text) => {
            await onAdd(text, rootType);
          }}
          suggestFrom={suggestFrom}
        />
      </div>
    </div>
  );
}

export default function HorizonPage() {
  const prefs = useHorizonPrefs();
  if (prefs.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading horizon...</div>
      </div>
    );
  }
  return <HorizonBoard prefs={prefs} />;
}

function HorizonBoard({ prefs }: { prefs: UseHorizonPrefsResult }) {
  const {
    views,
    defaultViewId: dbDefaultViewId,
    defaultLensId: dbDefaultLensId,
    secondaryMap: dbSecondaryMap,
  } = prefs;
  const ideasHook = useIdeas();
  const { ideas, loading, moveIdea, scheduleIdea } = ideasHook;
  const ideasRef = useRef(ideas);
  useEffect(() => {
    ideasRef.current = ideas;
  });
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const linksHook = useIdeaLinks();
  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();
  const [activeTab, setActiveTab] = useState<string>("short");
  const [overrides, setOverrides] = useState<Map<string, TreeOverrideState>>(() =>
    readTreeOverrides(STORAGE_KEYS.horizonTreeOverrides),
  );
  const [hideClosed, setHideClosed] = useState(true);
  const [typeFilter, setTypeFilter] = useState<IdeaType[]>([]);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [typePickerPos, setTypePickerPos] = useState<{ top: number; left: number } | null>(null);
  const cardMode = useUiPrefsStore((s) => s.cardMode);
  const hideProjectsWithTasks = useUiPrefsStore((s) => s.horizonHideProjectsWithTasks);
  const unclassifiedExpanded = useUiPrefsStore((s) => s.horizonUnclassifiedExpanded);
  const prefsLens = useUiPrefsStore((s) => s.horizonLens);
  const setPrefs = useUiPrefsStore((s) => s.set);
  const setCardMode = (v: boolean | ((p: boolean) => boolean)) =>
    setPrefs({ cardMode: typeof v === "function" ? v(cardMode) : v });
  const setUnclassifiedExpanded = (v: boolean | ((p: boolean) => boolean)) =>
    setPrefs({
      horizonUnclassifiedExpanded: typeof v === "function" ? v(unclassifiedExpanded) : v,
    });
  const {
    schemes,
    options: classificationOptions,
    classifications,
    setClassification,
    isLoading: classificationsLoading,
  } = useClassifications();
  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightId = searchParams.get("highlight");
  const horizonParam = searchParams.get("horizon");
  const lensParam = searchParams.get("lens");
  const [activeViewId, setActiveViewId] = useState<string | null>(() => {
    // Startup ignores local active selection ("forget local"): an explicit
    // ?lens= link wins, otherwise the synced default view (if any).
    if (lensParam) return null;
    const def = views.find((v) => v.id === dbDefaultViewId) ?? null;
    return def?.id ?? null;
  });
  const [defaultViewId, setDefaultViewId] = useState<string | null>(() => dbDefaultViewId);
  const [defaultLensId, setDefaultLensId] = useState<string | null>(() => dbDefaultLensId);
  const [lensKey, setLensKey] = useState<string>(() => {
    if (lensParam) return primarySchemeForKey(lensParam, new Set(schemes.map((s) => s.key)));
    const def = views.find((v) => v.id === dbDefaultViewId) ?? null;
    if (def) return def.primary;
    const defLens = DEFAULT_LENSES.find((l) => l.id === dbDefaultLensId) ?? null;
    if (defLens) return defLens.primaryScheme;
    return prefsLens ?? "term";
  });

  const [secondaryMap, setSecondaryMap] = useState<SecondaryLensMap>(() => {
    const def = !lensParam ? (views.find((v) => v.id === dbDefaultViewId) ?? null) : null;
    return def ? applyViewToSecondaryMap(def, dbSecondaryMap) : dbSecondaryMap;
  });
  const [sortBy, setSortBy] = useState<"manual" | "priority">(() => {
    const def = !lensParam ? (views.find((v) => v.id === dbDefaultViewId) ?? null) : null;
    if (def) return def.sortBy ?? "manual";
    // Built-in lenses always use lens order.
    if (!lensParam && DEFAULT_LENSES.some((l) => l.id === dbDefaultLensId)) return "priority";
    if (lensParam && DEFAULT_LENSES.some((l) => l.id === lensParam)) return "priority";
    return "manual";
  });

  // ---- Below-header lens edit session ----
  // The edit icon on a lens row closes the menu and opens an editor panel
  // below the header (name, description, primary). Per-column splits edit
  // directly on each primary box header. Changes apply live on the board;
  // Save persists them, Cancel restores the snapshot taken when the
  // session started.
  const [menuEditingId, setMenuEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [nameAutoFocus, setNameAutoFocus] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<{
    lensKey: string;
    sortBy: "manual" | "priority";
    secondaryMapJson: string;
    name: string;
    description: string;
    activeViewId: string | null;
  } | null>(null);

  /** Built-in lenses with user-edited names/descriptions overlaid from the
   *  seeded rows (matched by primary scheme). Selection stays id-based. */
  const displayLenses = useMemo(
    () =>
      DEFAULT_LENSES.map((l) => {
        const override = views.find((v) => v.is_builtin && v.primary === l.primaryScheme);
        return {
          id: l.id,
          name: override?.name ?? l.name,
          description: override?.description ?? l.description,
          primaryScheme: l.primaryScheme,
        };
      }),
    [views],
  );

  const orderedSchemes = useMemo(
    () => [...schemes].sort((a, b) => a.sort_order - b.sort_order),
    [schemes],
  );

  /** Group-by options for the edit panel: default lenses by lens name,
   *  then schemes without a default lens (synthesized) by scheme label. */
  const primaryOptions = useMemo(() => {
    const lensed = new Set(displayLenses.map((lens) => lens.primaryScheme));
    return [
      ...displayLenses.map((lens) => ({ value: lens.primaryScheme, label: lens.name })),
      ...orderedSchemes
        .filter((scheme) => !lensed.has(scheme.key))
        .map((scheme) => ({ value: scheme.key, label: scheme.label })),
    ];
  }, [displayLenses, orderedSchemes]);

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

  const validTabs = useMemo(() => new Set(columns.map((c) => groupKeyOf(c.key))), [columns]);

  const secondaryKeyOf = useCallback(
    (primaryValue: string | null): string | null => {
      if (primaryValue == null || !activeScheme) return null;
      const candidate = secondaryMap[activeScheme.key]?.[primaryValue] ?? null;
      if (!candidate || candidate === activeScheme.key || !schemeByKey.has(candidate)) return null;
      return candidate;
    },
    [secondaryMap, activeScheme, schemeByKey],
  );

  const secondaryValueOf = useCallback(
    (secondaryKey: string | null) =>
      (ideaId: string): string | null => {
        if (!secondaryKey) return null;
        return valuesBySchemeKey.get(secondaryKey)?.get(ideaId) ?? null;
      },
    [valuesBySchemeKey],
  );

  // cardMode persists via uiPrefsStore (no per-change localStorage write needed).

  const updateIdea = async (id: string, updates: Partial<Idea>) => {
    const previous = ideasHook.ideas.find((idea) => idea.id === id);
    await ideasHook.updateIdea(id, updates);
    if (!previous) return;
    const restore: Partial<Idea> = {};
    for (const key of Object.keys(updates) as Array<keyof Idea>) {
      restore[key] = previous[key] as never;
    }
    registerUndo({
      label: "Idea updated",
      run: async () => {
        await ideasHook.updateIdea(id, restore);
      },
    });
  };

  const deleteIdea = async (id: string) => {
    const deletedIds = getFocusedSubtreeIds(id, ideasHook.ideas);
    const deletedIdeas = ideasHook.ideas.filter((idea) => deletedIds.has(idea.id));
    const deletedLinks = linksHook.removeLinksForIdeaIds(deletedIds);
    await ideasHook.deleteIdea(id);
    if (deletedIdeas.length === 0) return;
    registerUndo({
      label: deletedIdeas.length > 1 ? "Ideas deleted" : "Idea deleted",
      run: async () => {
        await ideasHook.restoreIdeas(deletedIdeas);
        await linksHook.restoreLinks(deletedLinks);
      },
    });
  };

  const createIdea = async (
    text: string,
    parentId: string | null,
    position: CreateIdeaPosition,
    initialUpdates?: Partial<Idea>,
  ): Promise<string> => {
    const id = await ideasHook.createIdea(text, parentId, position, initialUpdates);
    if (id) {
      registerUndo({
        label: "Idea created",
        run: async () => {
          await ideasHook.deleteIdea(id);
        },
      });
    }
    return id;
  };

  const collapsedIds = useMemo(() => {
    const parentIds = new Set(
      ideas.filter((i) => ideas.some((c) => c.parent_id === i.id)).map((i) => i.id),
    );
    const collapsed = new Set<string>();

    for (const id of parentIds) {
      const override = overrides.get(id);
      if (override === "expanded") continue;
      collapsed.add(id);
    }
    return collapsed;
  }, [ideas, overrides]);

  const onToggleCollapse = (id: string) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      const isCurrentlyCollapsed = prev.get(id) === "collapsed" || !prev.has(id);
      next.set(id, isCurrentlyCollapsed ? "expanded" : "collapsed");
      writeTreeOverrides(STORAGE_KEYS.horizonTreeOverrides, next);
      return next;
    });
  };

  const onExpandIdea = (id: string) => {
    setOverrides((prev) => {
      if (!prev.has(id) || prev.get(id) === "expanded") return prev;
      const next = new Map(prev);
      next.set(id, "expanded");
      writeTreeOverrides(STORAGE_KEYS.horizonTreeOverrides, next);
      return next;
    });
  };

  const allTreeNodes = useMemo(
    () => buildFilteredTree(ideas, collapsedIds, hideClosed, hideProjectsWithTasks),
    [ideas, collapsedIds, hideClosed, hideProjectsWithTasks],
  );

  const priorityOf = useCallback(
    (ideaId: string): PriorityValue =>
      (valuesBySchemeKey.get("priority")?.get(ideaId) ?? null) as PriorityValue,
    [valuesBySchemeKey],
  );

  /** Lens-tiebreaker comparator for in-column ordering (unvalued last). */
  const lensCompare = useMemo(() => {
    const optionOrderByScheme = new Map<string, string[]>();
    for (const s of schemes) {
      optionOrderByScheme.set(
        s.key,
        classificationOptions
          .filter((o) => o.scheme_id === s.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((o) => o.value),
      );
    }
    const valueOfScheme = (ideaId: string, schemeKey: string): string | null =>
      valuesBySchemeKey.get(schemeKey)?.get(ideaId) ?? null;
    const sortOrderById = new Map(ideas.map((i) => [i.id, i.sort_order]));
    return buildLensComparator(
      lens,
      optionOrderByScheme,
      valueOfScheme,
      (ideaId) => sortOrderById.get(ideaId) ?? 0,
    );
  }, [lens, schemes, classificationOptions, valuesBySchemeKey, ideas]);

  const { grouped: treesByLens, promotedByParent } = useMemo(
    () => groupTreesByLens(allTreeNodes, valueOf, priorityOf, lensCompare),
    [allTreeNodes, valueOf, priorityOf, lensCompare],
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

  const orderedTreesByLens = useMemo(() => {
    if (sortBy === "priority") return filteredTreesByLens;
    const sortNodes = (nodes: IdeaNode[]): IdeaNode[] =>
      [...nodes]
        .map((node) => ({ ...node, children: sortNodes(node.children ?? []) }))
        .sort((a, b) => a.sort_order - b.sort_order);
    return Object.fromEntries(
      Object.entries(filteredTreesByLens).map(([key, nodes]) => [key, sortNodes(nodes)]),
    );
  }, [filteredTreesByLens, sortBy]);

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

  const handleSetValue = async (id: string, value: string | null) => {
    const previous = valueOf(id);
    await setClassification(id, lensKey, value);
    const lensLabel = activeScheme?.label ?? lensKey;
    registerUndo({
      label: `${lensLabel} updated`,
      run: async () => {
        await setClassification(id, lensKey, previous);
      },
    });
  };

  const handleSetPriority = async (id: string, value: string | null) => {
    const previous = valuesBySchemeKey.get("priority")?.get(id) ?? null;
    await setClassification(id, "priority", value);
    registerUndo({
      label: "Priority updated",
      run: async () => {
        await setClassification(id, "priority", previous);
      },
    });
  };

  const handleSetSecondary = async (secondaryKey: string, id: string, value: string | null) => {
    const previous = valuesBySchemeKey.get(secondaryKey)?.get(id) ?? null;
    await setClassification(id, secondaryKey, value);
    const lensLabel = schemeByKey.get(secondaryKey)?.label ?? secondaryKey;
    registerUndo({
      label: `${lensLabel} updated`,
      run: async () => {
        await setClassification(id, secondaryKey, previous);
      },
    });
  };

  const handleAdd = (value: string | null, secondaryKey: string | null = null) => {
    return async (text: string, type?: IdeaType, secondaryValue?: string | null): Promise<void> => {
      const id = await createIdea(text, null, "bottom", {
        type: type ?? "task",
        status: "draft",
      });
      if (id && value) {
        await setClassification(id, lensKey, value);
      }
      if (id && secondaryKey && secondaryValue) {
        await setClassification(id, secondaryKey, secondaryValue);
      }
    };
  };

  const toggleUnclassified = () => {
    setUnclassifiedExpanded(!unclassifiedExpanded);
  };

  const hasUnsavedEdits = useMemo(() => {
    if (menuEditingId == null || !editSnapshot) return false;
    if (draftName.trim() !== editSnapshot.name) return true;
    if (draftDescription !== editSnapshot.description) return true;
    if (lensKey !== editSnapshot.lensKey) return true;
    if (sortBy !== editSnapshot.sortBy) return true;
    if ((activeViewId ?? null) !== editSnapshot.activeViewId) return true;
    return JSON.stringify(secondaryMap) !== editSnapshot.secondaryMapJson;
  }, [
    menuEditingId,
    editSnapshot,
    draftName,
    draftDescription,
    lensKey,
    sortBy,
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
      setLensKey(editSnapshot.lensKey);
      setPrefs({ horizonLens: editSnapshot.lensKey });
      setSortBy(editSnapshot.sortBy);
      try {
        const restored = JSON.parse(editSnapshot.secondaryMapJson) as SecondaryLensMap;
        setSecondaryMap(restored);
        void prefs.setSecondaryMap(restored);
      } catch {
        // Corrupt snapshot (shouldn't happen): keep the live map.
      }
      setActiveViewId(editSnapshot.activeViewId);
      setPrefs({
        horizonActiveViewId: editSnapshot.activeViewId,
        horizonLensId: editSnapshot.activeViewId ? null : undefined,
      });
      const params = new URLSearchParams(searchParams.toString());
      params.set("lens", editSnapshot.lensKey);
      params.delete("horizon");
      router.replace(`/horizon?${params.toString()}`, { scroll: false });
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
  }, [menuEditingId, hasUnsavedEdits, editSnapshot, views, setPrefs, prefs, searchParams, router]);

  const handleSelectView = useCallback(
    (id: string) => {
      if (!leaveEditSession()) return;
      const view = views.find((v) => v.id === id);
      if (!view) return;
      setSecondaryMap((prev) => {
        const next = applyViewToSecondaryMap(view, prev);
        void prefs.setSecondaryMap(next);
        return next;
      });
      setActiveViewId(id);
      setPrefs({ horizonActiveViewId: id, horizonLensId: null });
      setSortBy(view.sortBy ?? "manual");
      setLensKey(view.primary);
      setPrefs({ horizonLens: view.primary });
      const params = new URLSearchParams(searchParams.toString());
      params.set("lens", view.primary);
      params.delete("horizon");
      router.replace(`/horizon?${params.toString()}`, { scroll: false });
    },
    [views, searchParams, router, setPrefs, prefs, leaveEditSession],
  );

  const handleSelectLens = useCallback(
    (next: HorizonLensDef) => {
      if (!leaveEditSession()) return;
      // Selecting a built-in lens always uses lens order; saved views keep
      // their own sortBy.
      setSortBy("priority");
      setLensKey(next.primaryScheme);
      setPrefs({
        horizonLens: next.primaryScheme,
        horizonLensId: next.id,
        horizonActiveViewId: null,
      });
      setActiveViewId(null);
      const params = new URLSearchParams(searchParams.toString());
      params.set("lens", next.primaryScheme);
      params.delete("horizon");
      router.replace(`/horizon?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, setPrefs, leaveEditSession],
  );

  const handleDeleteView = useCallback(
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

  const handleToggleDefaultView = useCallback(
    (id: string) => {
      const next = id === defaultViewId ? null : id;
      setDefaultViewId(next);
      // The two stars are mutually exclusive (single-statement setDefault).
      setDefaultLensId(null);
      void prefs.setDefault(next ? { viewId: next } : {});
    },
    [defaultViewId, prefs],
  );

  const handleToggleDefaultLens = useCallback(
    (id: string) => {
      const next = id === defaultLensId ? null : id;
      setDefaultLensId(next);
      setDefaultViewId(null);
      void prefs.setDefault(next ? { lensId: next } : {});
    },
    [defaultLensId, prefs],
  );

  const activeView = views.find((v) => v.id === activeViewId) ?? null;

  // ---- Below-header edit session targets ----
  const activeDisplayLens =
    !activeView && !lensSynthesized ? (displayLenses.find((l) => l.id === lens.id) ?? null) : null;
  /** The saved view under edit, if the session targets one (built-in lenses
   *  are id-addressed and keep their grouping fixed). */
  const editingTargetView =
    menuEditingId != null
      ? (views.find((v) => v.id === menuEditingId && !v.is_builtin) ?? null)
      : null;
  const primaryLocked = menuEditingId == null || editingTargetView == null;

  /** Start a below-header edit session for a lens row (built-in id or
   *  view id). The lens is activated first so criteria changes preview
   *  live. An in-progress session is left (with confirm) first. */
  const handleStartMenuEdit = useCallback(
    (id: string) => {
      if (!leaveEditSession()) return;
      const view = views.find((v) => v.id === id && !v.is_builtin) ?? null;
      if (view) {
        const merged = applyViewToSecondaryMap(view, secondaryMap);
        setSecondaryMap(merged);
        void prefs.setSecondaryMap(merged);
        setActiveViewId(id);
        setPrefs({ horizonActiveViewId: id, horizonLensId: null });
        setSortBy(view.sortBy ?? "manual");
        setLensKey(view.primary);
        setPrefs({ horizonLens: view.primary });
        setDraftName(view.name);
        setDraftDescription(view.description);
        setEditSnapshot({
          lensKey: view.primary,
          sortBy: view.sortBy ?? "manual",
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
        setSortBy("priority");
        setLensKey(def.primaryScheme);
        setPrefs({
          horizonLens: def.primaryScheme,
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
          sortBy: "priority",
          secondaryMapJson: JSON.stringify(secondaryMap),
          name: name.trim(),
          description,
          activeViewId: null,
        });
      }
      const params = new URLSearchParams(searchParams.toString());
      params.delete("horizon");
      router.replace(`/horizon?${params.toString()}`, { scroll: false });
      setMenuEditingId(id);
      setNameAutoFocus(true);
    },
    [views, secondaryMap, prefs, setPrefs, searchParams, router, leaveEditSession],
  );

  /** Create lens: an empty slot (untitled row) selected at once, with the
   *  name input focused so the user names it right away. */
  const handleCreateLens = useCallback(() => {
    if (!leaveEditSession()) return;
    const created: HorizonView = {
      id: newHorizonViewId(),
      name: "Untitled lens",
      description: "",
      primary: lensKey,
      column_order: [],
      tiebreakers: [],
      splits: snapshotSplits(
        columns.map((c) => c.key),
        secondaryKeyOf,
      ),
      sortBy,
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
      sortBy,
      secondaryMapJson: JSON.stringify(secondaryMap),
      name: "",
      description: "",
      activeViewId: created.id,
    });
    setMenuEditingId(created.id);
    setNameAutoFocus(true);
  }, [lensKey, sortBy, secondaryMap, columns, secondaryKeyOf, prefs, setPrefs, leaveEditSession]);

  const handleSaveLensEdits = useCallback(() => {
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
        sortBy,
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
          sortBy,
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
          tiebreakers: [],
          splits,
          sortBy,
          is_builtin: false,
        };
        void prefs.saveView(created);
        setActiveViewId(created.id);
        setPrefs({ horizonActiveViewId: created.id, horizonLensId: null });
      }
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("lens", lensKey);
    params.delete("horizon");
    router.replace(`/horizon?${params.toString()}`, { scroll: false });
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
    sortBy,
    views,
    lensSynthesized,
    lens,
    prefs,
    setPrefs,
    searchParams,
    router,
  ]);

  const handlePrimaryChangeLive = useCallback(
    (scheme: string) => {
      if (menuEditingId == null || primaryLocked) return;
      setLensKey(scheme);
      setPrefs({ horizonLens: scheme });
      // Detach from the saved view: the board no longer matches it.
      setActiveViewId(null);
      setPrefs({ horizonActiveViewId: null });
      const params = new URLSearchParams(searchParams.toString());
      params.set("lens", scheme);
      params.delete("horizon");
      router.replace(`/horizon?${params.toString()}`, { scroll: false });
    },
    [menuEditingId, primaryLocked, setPrefs, searchParams, router],
  );

  const handleSplitChangeLive = useCallback(
    (colKey: string | null, value: string | null) => {
      if (menuEditingId == null || !activeScheme || colKey == null) return;
      const primaryKey = activeScheme.key;
      const groupKey = viewColumnKey(colKey);
      setSecondaryMap((prev) => {
        const next = {
          ...prev,
          [primaryKey]: { ...(prev[primaryKey] ?? {}), [groupKey]: value },
        };
        void prefs.setSecondaryMap(next);
        return next;
      });
    },
    [menuEditingId, activeScheme, prefs],
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

  // Sync mobile tab from ?horizon=, and repair the tab whenever the columns
  // change underneath it (lens switch, classifications loading).
  useEffect(() => {
    if (horizonParam && validTabs.has(horizonParam)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync tab from URL param
      setActiveTab(horizonParam);
    } else if (!validTabs.has(activeTab)) {
      setActiveTab(columns[0] ? groupKeyOf(columns[0].key) : UNCLASSIFIED);
    }
  }, [horizonParam, validTabs, columns, activeTab]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const currentIdeas = ideasRef.current;
    const idea = currentIdeas.find((i) => i.id === highlightId);
    if (idea) setActiveTab(groupKeyOf(valueOf(idea.id)));
    // Guarantee an unclassified highlight target is visible: expand the strip.
    if (idea && valueOf(idea.id) == null) {
      setPrefs({ horizonUnclassifiedExpanded: true });
    }
    // Guarantee the highlight target is visible: lift filters that could hide it.
    if (idea && !ACTIVE_STATUSES.has(idea.status)) {
      setHideClosed(false);
    }
    if (idea && idea.type) {
      setTypeFilter([]);
    }
    if (idea && idea.type === "project" && hideProjectsWithTasks) {
      setPrefs({ horizonHideProjectsWithTasks: false });
    }
    const expandAncestors = (id: string) => {
      const m = new Map(currentIdeas.map((i) => [i.id, i]));
      let cur = m.get(id);
      const ids: string[] = [];
      while (cur?.parent_id) {
        ids.push(cur.parent_id);
        cur = m.get(cur.parent_id);
      }
      if (ids.length > 0) {
        setOverrides((prev) => {
          const next = new Map(prev);
          for (const anc of ids) next.set(anc, "expanded");
          writeTreeOverrides(STORAGE_KEYS.horizonTreeOverrides, next);
          return next;
        });
      }
    };
    expandAncestors(highlightId);
    const timer = setTimeout(() => {
      const el = document.getElementById(`idea-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-pulse");
        const cleanup = () => el.classList.remove("highlight-pulse");
        el.addEventListener("animationend", cleanup, { once: true });
        setTimeout(cleanup, 2500);
      }
      const params = new URLSearchParams(searchParams.toString());
      params.delete("highlight");
      router.replace(`/horizon?${params.toString()}`, { scroll: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [highlightId, loading, searchParams, router, valueOf, setPrefs, hideProjectsWithTasks]);

  if (loading || classificationsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading horizon...</div>
      </div>
    );
  }

  const renderColumn = (col: LensColumn) => {
    const nodes = orderedTreesByLens[groupKeyOf(col.key)] ?? [];
    const isCollapsedStrip = col.key === null && !unclassifiedExpanded;
    const secondaryKey = secondaryKeyOf(col.key);
    const secondaryScheme = secondaryKey ? (schemeByKey.get(secondaryKey) ?? null) : null;
    const secondaryOptions = secondaryScheme
      ? ((optionsBySchemeId.get(secondaryScheme.id) ?? []).map((o) => ({
          key: o.value,
          label: o.label,
        })) as { key: string; label: string }[])
      : [];
    const collapseControl =
      col.key === null ? (
        <button
          type="button"
          onClick={toggleUnclassified}
          title="Collapse unclassified section"
          aria-label="Collapse unclassified section"
          className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <ChevronUp size={14} />
        </button>
      ) : undefined;
    const body = (
      <div className="max-h-[calc(100vh-220px)] min-h-[120px] flex-1 overflow-y-auto">
        <HorizonTree
          nodes={nodes}
          ideas={ideas}
          lensKey={lensKey}
          groupValue={col.key}
          onSetValue={handleSetValue}
          secondaryKey={secondaryKey}
          secondaryOptions={secondaryOptions}
          secondaryLabel={secondaryScheme?.label}
          secondaryValueOf={secondaryValueOf(secondaryKey)}
          onSetSecondary={
            secondaryKey ? (id, value) => handleSetSecondary(secondaryKey, id, value) : undefined
          }
          onAddSecondary={
            secondaryKey
              ? (text, type, secVal) => handleAdd(col.key, secondaryKey)(text, type, secVal)
              : undefined
          }
          collapsed={isCollapsedStrip}
          onToggleCollapsed={toggleUnclassified}
          groupLabel={col.label}
          cardMode={cardMode}
          promotedByParent={promotedByParent}
          columnLabelByKey={columnLabelByKey}
          secondaryGrouped={secondaryByPrimary[groupKeyOf(col.key)]?.grouped}
          secondaryPromotedByParent={secondaryByPrimary[groupKeyOf(col.key)]?.promoted}
          secondaryLabelByValue={secondaryByPrimary[groupKeyOf(col.key)]?.labelByValue}
          allTags={tagsHook.tags}
          links={linksHook.links}
          getTagsForIdea={taskTagsHook.getTagsForIdea}
          onUpdate={updateIdea}
          onDelete={deleteIdea}
          onSchedule={scheduleIdea}
          onMove={moveIdea}
          onCreateLink={linksHook.createLink}
          onDeleteLink={linksHook.deleteLink}
          onAddTag={taskTagsHook.addTagToTask}
          onRemoveTag={taskTagsHook.removeTagFromTask}
          onCreateTag={tagsHook.createTag}
          createIdea={createIdea}
          onToggleCollapse={onToggleCollapse}
          onExpand={onExpandIdea}
          priorityValueOf={priorityOf}
          onSetPriority={handleSetPriority}
          emptyMessage={
            <p className="px-4 py-6 text-center text-xs text-gray-400 italic dark:text-gray-500">
              No items yet
            </p>
          }
        />
      </div>
    );
    // While an edit session is active, each primary box carries its
    // Split control in the top-right corner (unclassified is never split).
    const splitSelect =
      menuEditingId != null && col.key !== null ? (
        <select
          value={secondaryKeyOf(col.key) ?? ""}
          onChange={(event) => handleSplitChangeLive(col.key, event.target.value || null)}
          title="Split this group into sub-groups"
          aria-label={`Split ${col.label} by`}
          className="max-w-40 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">No split</option>
          {orderedSchemes
            .filter((scheme) => scheme.key !== lensKey)
            .map((scheme) => (
              <option key={scheme.key} value={scheme.key}>
                {scheme.label}
              </option>
            ))}
        </select>
      ) : undefined;
    if (isCollapsedStrip) return body;
    return (
      <ColumnShell
        label={col.label}
        count={nodes.length}
        collapseControl={collapseControl}
        headerActions={splitSelect}
        footer={
          !secondaryKey ? (
            <RootAddInput label={col.label} onAdd={handleAdd(col.key)} suggestFrom={ideas} />
          ) : undefined
        }
      >
        {body}
      </ColumnShell>
    );
  };

  const headerStartActions = (
    <>
      <HorizonViewSwitcher
        views={views}
        activeViewId={activeViewId}
        defaultViewId={defaultViewId}
        lenses={displayLenses}
        activeLensId={!activeView && !lensSynthesized ? lens.id : null}
        defaultLensId={defaultLensId}
        schemes={schemes}
        onSelect={handleSelectView}
        onDelete={handleDeleteView}
        onToggleDefault={handleToggleDefaultView}
        onSelectLens={handleSelectLens}
        onToggleDefaultLens={handleToggleDefaultLens}
        onCreateLens={handleCreateLens}
        onStartEdit={handleStartMenuEdit}
      />
      <button
        type="button"
        onClick={() => setHideClosed((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          hideClosed
            ? "border-indigo-300 bg-white text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
            : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
        }`}
      >
        <EyeOff size={12} />
        <span className="hidden sm:inline">Hide closed</span>
      </button>
      <button
        type="button"
        onClick={() => setPrefs({ horizonHideProjectsWithTasks: !hideProjectsWithTasks })}
        title="Hide projects that have a visible task (tasks show on their own with the project breadcrumb)"
        aria-pressed={hideProjectsWithTasks}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          hideProjectsWithTasks
            ? "border-indigo-300 bg-white text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
            : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
        }`}
      >
        <EyeOff size={12} />
        <span className="hidden sm:inline">Hide projects with visible tasks</span>
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTypePickerPos({ top: rect.bottom + 4, left: rect.left });
            setTypePickerOpen((v) => !v);
          }}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            typeFilter.length > 0
              ? "border-indigo-300 bg-white text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
              : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
          }`}
        >
          <Tag size={12} />
          <span className="hidden sm:inline">
            {typeFilter.length > 0
              ? `${typeFilter.length} type${typeFilter.length > 1 ? "s" : ""}`
              : "Type"}
          </span>
        </button>
        {typePickerOpen && typePickerPos && (
          <TypeFilterPicker
            selected={typeFilter}
            onToggle={(type) =>
              setTypeFilter((prev) =>
                prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
              )
            }
            onClear={() => setTypeFilter([])}
            onClose={() => setTypePickerOpen(false)}
            position={typePickerPos}
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => setCardMode((v) => !v)}
        className={`toolbar-btn ${cardMode ? "toolbar-btn--accent" : ""}`}
        title={cardMode ? "Show rows" : "Show cards"}
        aria-pressed={cardMode}
      >
        {cardMode ? "Rows" : "Cards"}
      </button>
    </>
  );

  const titleName =
    menuEditingId != null && draftName.trim()
      ? draftName.trim()
      : (activeView?.name ?? activeDisplayLens?.name ?? lens?.name);
  return (
    <AppShell
      title={titleName ? `Horizon · ${titleName}` : "Horizon"}
      headerStartActions={headerStartActions}
    >
      {menuEditingId != null && (
        <LensEditPanel
          draftName={draftName}
          draftDescription={draftDescription}
          onDraftNameChange={setDraftName}
          onDraftDescriptionChange={setDraftDescription}
          primaryOptions={primaryOptions}
          livePrimary={lensKey}
          onPrimaryChange={handlePrimaryChangeLive}
          primaryLocked={primaryLocked}
          hasUnsavedEdits={hasUnsavedEdits}
          nameAutoFocus={nameAutoFocus}
          onSave={handleSaveLensEdits}
          onCancel={leaveEditSession}
        />
      )}
      <UndoBar undoAction={undoAction} onUndo={() => void handleUndo()} onDismiss={clearUndo} />

      {/* Mobile tab bar */}
      <div className="sticky top-[53px] z-10 mb-4 flex gap-1 overflow-x-auto rounded-xl bg-black/[0.03] p-1 md:hidden dark:bg-white/[0.04]">
        {columns.map((col) => (
          <button
            key={groupKeyOf(col.key)}
            onClick={() => setActiveTab(groupKeyOf(col.key))}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === groupKeyOf(col.key)
                ? "bg-violet-100/80 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            }`}
          >
            {col.label}
          </button>
        ))}
      </div>

      {/* Desktop: columns stacked vertically */}
      <div className="hidden gap-5 md:flex md:flex-col">
        {columns.map((col, i) => (
          <motion.div
            key={groupKeyOf(col.key)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: "easeOut" }}
            className="min-w-0"
          >
            {renderColumn(col)}
          </motion.div>
        ))}
      </div>

      {/* Mobile: single column with animated tab switch */}
      <div className="md:hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            {renderColumn(columns.find((c) => groupKeyOf(c.key) === activeTab) ?? columns[0])}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

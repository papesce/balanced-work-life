"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EyeOff, Tag } from "lucide-react";
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
import { HorizonColumn } from "@/components/horizon/HorizonColumn";
import { RootAddInput } from "@/components/horizon/RootAddInput";
import { HorizonViewSwitcher } from "@/components/horizon/HorizonViewSwitcher";
import { LensEditPanel } from "@/components/horizon/LensEditPanel";
import { type PriorityValue } from "@/components/shared/PriorityChip";
import { TypeFilterPicker } from "@/components/shared/TypeFilterPicker";
import { Idea, IdeaNode, IdeaType } from "@/lib/types";
import { useClassifications } from "@/hooks/useClassifications";
import { useHorizonPrefs, type UseHorizonPrefsResult } from "@/hooks/useHorizonPrefs";
import { useHorizonUrl } from "@/hooks/useHorizonUrl";
import { useHorizonSelection } from "@/hooks/useHorizonSelection";
import { useHorizonLensSession } from "@/hooks/useHorizonLensSession";
import {
  STORAGE_KEYS,
  readTreeOverrides,
  writeTreeOverrides,
  type TreeOverrideState,
} from "@/lib/storage";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";

import { UNCLASSIFIED, groupKeyOf, type LensColumn } from "@/components/lens";
import { groupTreesByLens, groupSecondaryByLens } from "@/lib/horizonGrouping";
import { getHiddenProjectIds } from "@/lib/horizonProjectVisibility";
import { type HorizonLensDef } from "@/lib/horizonLenses";

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
  const byId = new Map(pool.map((i) => [i.id, i] as const));
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
      const parent = byId.get(cur.parent_id);
      if (!parent) break;
      cur = parent;
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
  const { updateParams, setLensParam, lensParam, horizonParam, highlightId } = useHorizonUrl();
  const selection = useHorizonSelection({
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
  });
  const {
    lensKey,
    activeViewId,
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
    defaultViewId,
    defaultLensId,
  } = selection;
  const session = useHorizonLensSession({
    selection,
    views,
    prefs,
    schemes,
    setLensParam,
    updateParams,
  });
  const {
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
  } = session;

  const orderedSchemes = useMemo(
    () => [...schemes].sort((a, b) => a.sort_order - b.sort_order),
    [schemes],
  );
  /** Group-by candidates for the per-column Split selects (active lens excluded). */
  const splitSchemeOptions = useMemo(
    () =>
      orderedSchemes
        .filter((scheme) => scheme.key !== lensKey)
        .map((scheme) => ({ key: scheme.key, label: scheme.label })),
    [orderedSchemes, lensKey],
  );

  const validTabs = useMemo(() => new Set(columns.map((c) => groupKeyOf(c.key))), [columns]);

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

  /** Set a classification with undo support (shared by primary/priority/secondary). */
  const handleSetClassification = async (
    schemeKey: string,
    id: string,
    value: string | null,
    previous: string | null,
    label: string,
  ) => {
    await setClassification(id, schemeKey, value);
    registerUndo({
      label: `${label} updated`,
      run: async () => {
        await setClassification(id, schemeKey, previous);
      },
    });
  };

  const handleSetValue = (id: string, value: string | null) =>
    handleSetClassification(lensKey, id, value, valueOf(id), activeScheme?.label ?? lensKey);

  const handleSetPriority = (id: string, value: string | null) =>
    handleSetClassification(
      "priority",
      id,
      value,
      valuesBySchemeKey.get("priority")?.get(id) ?? null,
      "Priority",
    );

  const handleSetSecondary = (secondaryKey: string, id: string, value: string | null) =>
    handleSetClassification(
      secondaryKey,
      id,
      value,
      valuesBySchemeKey.get(secondaryKey)?.get(id) ?? null,
      schemeByKey.get(secondaryKey)?.label ?? secondaryKey,
    );

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

  // Selection actions are guarded by the edit session: switching lens/view
  // mid-edit asks to discard first.
  const handleSelectView = useCallback(
    (id: string) => {
      if (!leaveEditSession()) return;
      selectView(id);
    },
    [leaveEditSession, selectView],
  );

  const handleSelectLens = useCallback(
    (next: HorizonLensDef) => {
      if (!leaveEditSession()) return;
      selectLens(next);
    },
    [leaveEditSession, selectLens],
  );

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
      updateParams((params) => {
        params.delete("highlight");
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [highlightId, loading, updateParams, valueOf, setPrefs, hideProjectsWithTasks]);

  if (loading || classificationsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading horizon...</div>
      </div>
    );
  }

  const renderColumn = (col: LensColumn) => {
    const nodes = filteredTreesByLens[groupKeyOf(col.key)] ?? [];
    const secondaryKey = secondaryKeyOf(col.key);
    const secondaryScheme = secondaryKey ? (schemeByKey.get(secondaryKey) ?? null) : null;
    const secondaryOptions = secondaryScheme
      ? ((optionsBySchemeId.get(secondaryScheme.id) ?? []).map((o) => ({
          key: o.value,
          label: o.label,
        })) as { key: string; label: string }[])
      : [];
    return (
      <HorizonColumn
        col={col}
        count={nodes.length}
        unclassifiedExpanded={unclassifiedExpanded}
        onToggleUnclassified={toggleUnclassified}
        editSessionActive={menuEditingId != null}
        secondaryKey={secondaryKey}
        splitOptions={splitSchemeOptions}
        onSplitChange={splitChangeLive}
        footer={
          !secondaryKey ? (
            <RootAddInput label={col.label} onAdd={handleAdd(col.key)} suggestFrom={ideas} />
          ) : undefined
        }
        treeProps={{
          nodes,
          ideas,
          lensKey,
          groupValue: col.key,
          onSetValue: handleSetValue,
          secondaryKey,
          secondaryOptions,
          secondaryLabel: secondaryScheme?.label,
          secondaryValueOf: secondaryValueOf(secondaryKey),
          onSetSecondary: secondaryKey
            ? (id, value) => handleSetSecondary(secondaryKey, id, value)
            : undefined,
          onAddSecondary: secondaryKey
            ? (text, type, secVal) => handleAdd(col.key, secondaryKey)(text, type, secVal)
            : undefined,
          collapsed: col.key === null && !unclassifiedExpanded,
          onToggleCollapsed: toggleUnclassified,
          groupLabel: col.label,
          cardMode,
          promotedByParent,
          columnLabelByKey,
          secondaryGrouped: secondaryByPrimary[groupKeyOf(col.key)]?.grouped,
          secondaryPromotedByParent: secondaryByPrimary[groupKeyOf(col.key)]?.promoted,
          secondaryLabelByValue: secondaryByPrimary[groupKeyOf(col.key)]?.labelByValue,
          allTags: tagsHook.tags,
          links: linksHook.links,
          getTagsForIdea: taskTagsHook.getTagsForIdea,
          onUpdate: updateIdea,
          onDelete: deleteIdea,
          onSchedule: scheduleIdea,
          onMove: moveIdea,
          onCreateLink: linksHook.createLink,
          onDeleteLink: linksHook.deleteLink,
          onAddTag: taskTagsHook.addTagToTask,
          onRemoveTag: taskTagsHook.removeTagFromTask,
          onCreateTag: tagsHook.createTag,
          createIdea,
          onToggleCollapse,
          onExpand: onExpandIdea,
          priorityValueOf: priorityOf,
          onSetPriority: handleSetPriority,
          emptyMessage: (
            <p className="px-4 py-6 text-center text-xs text-gray-400 italic dark:text-gray-500">
              No items yet
            </p>
          ),
        }}
      />
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
        onDelete={deleteView}
        onToggleDefault={toggleDefaultView}
        onSelectLens={handleSelectLens}
        onToggleDefaultLens={toggleDefaultLens}
        onCreateLens={createLens}
        onStartEdit={startMenuEdit}
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
          onPrimaryChange={primaryChangeLive}
          primaryLocked={primaryLocked}
          hasUnsavedEdits={hasUnsavedEdits}
          nameAutoFocus={nameAutoFocus}
          onSave={saveLensEdits}
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

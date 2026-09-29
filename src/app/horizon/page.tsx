"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, EyeOff, Target, Tag } from "lucide-react";
import { useIdeas, type CreateIdeaPosition } from "@/hooks/useIdeas";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useUndoAction } from "@/lib/tasks/undo";
import { filterTreeByFocus, filterTreeByType } from "@/lib/ideaTreeFilters";
import { getFocusedSubtreeIds } from "@/lib/ideaTreeFocus";
import { buildTree as buildTreeGeneric } from "@/components/tree/buildTree";
import { AppShell } from "@/components/AppShell";
import { UndoBar } from "@/components/shared/UndoBar";
import { QuickAddInput } from "@/components/timeline/QuickAddInput";
import { HorizonTree } from "@/components/horizon/HorizonTree";
import { priorityRank, type PriorityValue } from "@/components/shared/PriorityChip";
import { TypePicker } from "@/components/brainstorm/TypePicker";
import { TypeFilterPicker } from "@/components/shared/TypeFilterPicker";
import { Idea, IdeaNode, IdeaType } from "@/lib/types";
import { TYPE_BADGE } from "@/lib/constants";
import { useClassifications } from "@/hooks/useClassifications";
import {
  STORAGE_KEYS,
  SecondaryLensMap,
  TreeOverrideState,
  readRawString,
  writeRawString,
  readSecondaryLensMap,
  readTreeOverrides,
  writeSecondaryLensMap,
  writeTreeOverrides,
} from "@/lib/storage";

import {
  useLens,
  LensTabs,
  ColumnShell,
  UNCLASSIFIED,
  groupKeyOf,
  type LensColumn,
} from "@/components/lens";

const ACTIVE_STATUSES = new Set(["draft", "planned", "in_progress", "scheduled"]);

function buildFilteredTree(
  ideas: Idea[],
  collapsedIds: Set<string>,
  hideClosed: boolean,
): IdeaNode[] {
  const pool = hideClosed ? ideas.filter((i) => ACTIVE_STATUSES.has(i.status)) : ideas;

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
  const badge = TYPE_BADGE[rootType];

  return (
    <div className="border-t border-black/[0.02] px-4 py-2 dark:border-white/[0.02]">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowTypePicker(!showTypePicker)}
            className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${badge.className} cursor-pointer transition-opacity hover:opacity-80`}
          >
            {badge.label}
          </button>
          {showTypePicker && (
            <TypePicker
              current={rootType}
              onSelect={(type) => {
                setRootType(type ?? "task");
                setShowTypePicker(false);
              }}
              onClose={() => setShowTypePicker(false)}
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
  const [focusOnly, setFocusOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<IdeaType[]>([]);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [cardMode, setCardMode] = useState(
    () => readRawString(STORAGE_KEYS.brainstormCardMode) === "true",
  );
  const [unclassifiedExpanded, setUnclassifiedExpanded] = useState(
    () => readRawString(STORAGE_KEYS.horizonUnclassifiedExpanded) === "true",
  );
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
  const [lensKey, setLensKey] = useState<string>(
    () => lensParam ?? readRawString(STORAGE_KEYS.horizonLens) ?? "term",
  );

  const [secondaryMap, setSecondaryMap] = useState<SecondaryLensMap>(() =>
    readSecondaryLensMap(STORAGE_KEYS.horizonSecondaryMap),
  );

  /** Active lens scheme; unknown keys fall back to Term. */
  const { valuesBySchemeKey, schemeByKey, activeScheme, optionsBySchemeId, columns, valueOf } =
    useLens({ schemes, classificationOptions, classifications, lensKey });

  const validTabs = useMemo(() => new Set(columns.map((c) => groupKeyOf(c.key))), [columns]);

  const lensTabItems = useMemo(
    () =>
      [...schemes]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({ key: s.key, label: s.label })),
    [schemes],
  );

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

  const handleSecondaryChange = useCallback(
    (primaryValue: string | null, next: string | null) => {
      if (primaryValue == null || !activeScheme) return;
      if (next && (next === activeScheme.key || !schemeByKey.has(next))) return;
      setSecondaryMap((prev) => {
        const nextMap: SecondaryLensMap = {
          ...prev,
          [activeScheme.key]: { ...(prev[activeScheme.key] ?? {}), [primaryValue]: next },
        };
        writeSecondaryLensMap(STORAGE_KEYS.horizonSecondaryMap, nextMap);
        return nextMap;
      });
    },
    [activeScheme, schemeByKey],
  );

  useEffect(() => {
    writeRawString(STORAGE_KEYS.brainstormCardMode, String(cardMode));
  }, [cardMode]);

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
    () => buildFilteredTree(ideas, collapsedIds, hideClosed),
    [ideas, collapsedIds, hideClosed],
  );

  const priorityOf = useCallback(
    (ideaId: string): PriorityValue =>
      (valuesBySchemeKey.get("priority")?.get(ideaId) ?? null) as PriorityValue,
    [valuesBySchemeKey],
  );

  const treesByLens = useMemo(() => {
    const grouped: Record<string, IdeaNode[]> = {};

    // Recursively lift classified descendants whose own column differs from
    // the root column they are nested under. Returns the pruned node.
    // Containment context lives in the Details drawer, never as tree rows.
    const process = (node: IdeaNode, rootColumnKey: string): IdeaNode => {
      const keptChildren: IdeaNode[] = [];
      for (const child of node.children) {
        const childValue = valueOf(child.id);
        const childColumnKey = groupKeyOf(childValue);
        // Promote only classified descendants; unclassified nodes always
        // stay nested under their parent.
        if (childValue != null && childColumnKey !== rootColumnKey) {
          // Promote: child's own subtree (recursively processed against its
          // own column) becomes a pseudo-root in its own column.
          const promoted = process(child, childColumnKey);
          (grouped[childColumnKey] ??= []).push(promoted);
        } else {
          keptChildren.push(process(child, rootColumnKey));
        }
      }
      return { ...node, children: keptChildren };
    };

    for (const node of allTreeNodes) {
      const k = groupKeyOf(valueOf(node.id));
      (grouped[k] ??= []).push(process(node, k));
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => {
        const rankDiff = priorityRank(priorityOf(a.id)) - priorityRank(priorityOf(b.id));
        if (rankDiff !== 0) return rankDiff;
        return a.sort_order - b.sort_order;
      });
    }
    return grouped;
  }, [allTreeNodes, valueOf, priorityOf]);

  const filteredTreesByLens = useMemo(() => {
    let result = treesByLens;
    if (focusOnly) {
      const focused: Record<string, IdeaNode[]> = {};
      for (const key of Object.keys(result)) {
        focused[key] = filterTreeByFocus(result[key], ideas);
      }
      result = focused;
    }
    if (typeFilter.length > 0) {
      const typed: Record<string, IdeaNode[]> = {};
      for (const key of Object.keys(result)) {
        typed[key] = filterTreeByType(result[key], typeFilter);
      }
      result = typed;
    }
    return result;
  }, [treesByLens, focusOnly, typeFilter, ideas]);

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
    setUnclassifiedExpanded((v) => {
      writeRawString(STORAGE_KEYS.horizonUnclassifiedExpanded, String(!v));
      return !v;
    });
  };

  const handleLensChange = (key: string) => {
    if (key === lensKey) return;
    setLensKey(key);
    writeRawString(STORAGE_KEYS.horizonLens, key);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lens", key);
    params.delete("horizon");
    router.replace(`/horizon?${params.toString()}`, { scroll: false });
  };

  // Sync lens from ?lens= (deep links, global search) when it names a real scheme.
  useEffect(() => {
    if (lensParam && lensParam !== lensKey && schemes.some((s) => s.key === lensParam)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync lens from URL param
      setLensKey(lensParam);
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
      setUnclassifiedExpanded(true);
      writeRawString(STORAGE_KEYS.horizonUnclassifiedExpanded, "true");
    }
    // Guarantee the highlight target is visible: lift filters that could hide it.
    if (idea && !ACTIVE_STATUSES.has(idea.status)) {
      setHideClosed(false);
    }
    if (idea && idea.type) {
      setFocusOnly(false);
      setTypeFilter([]);
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
  }, [highlightId, loading, searchParams, router, valueOf]);

  if (loading || classificationsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading horizon...</div>
      </div>
    );
  }

  const renderColumn = (col: LensColumn) => {
    const nodes = filteredTreesByLens[groupKeyOf(col.key)] ?? [];
    const isCollapsedStrip = col.key === null && !unclassifiedExpanded;
    const secondaryKey = secondaryKeyOf(col.key);
    const secondaryScheme = secondaryKey ? (schemeByKey.get(secondaryKey) ?? null) : null;
    const secondaryOptions = secondaryScheme
      ? ((optionsBySchemeId.get(secondaryScheme.id) ?? []).map((o) => ({
          key: o.value,
          label: o.label,
        })) as { key: string; label: string }[])
      : [];
    const secondaryChoices = [...schemes]
      .sort((a, b) => a.sort_order - b.sort_order)
      .filter((s) => s.key !== lensKey);
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
    const headerActions =
      col.key !== null ? (
        <label className="flex items-center gap-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
          <span className="hidden lg:inline">Split</span>
          <select
            aria-label={`Secondary classification for ${col.label}`}
            value={secondaryKey ?? ""}
            onChange={(e) => handleSecondaryChange(col.key, e.target.value || null)}
            className="max-w-[110px] cursor-pointer rounded-md border border-black/10 bg-transparent px-1 py-0.5 text-[11px] font-semibold text-gray-500 dark:border-white/10 dark:text-gray-400"
          >
            <option value="">None</option>
            {secondaryChoices.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
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
          onToggleInFocus={ideasHook.toggleInFocus}
          emptyMessage={
            <p className="px-4 py-6 text-center text-xs text-gray-400 italic dark:text-gray-500">
              No items yet
            </p>
          }
        />
      </div>
    );
    if (isCollapsedStrip) return body;
    return (
      <ColumnShell
        label={col.label}
        count={nodes.length}
        collapseControl={collapseControl}
        headerActions={headerActions}
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
      <LensTabs tabs={lensTabItems} activeKey={lensKey} onChange={handleLensChange} />
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
        onClick={() => setFocusOnly((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          focusOnly
            ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-900/20 dark:text-amber-300"
            : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
        }`}
      >
        <Target size={12} />
        <span className="hidden sm:inline">Focus only</span>
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setTypePickerOpen((v) => !v)}
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
        {typePickerOpen && (
          <TypeFilterPicker
            selected={typeFilter}
            onToggle={(type) =>
              setTypeFilter((prev) =>
                prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
              )
            }
            onClear={() => setTypeFilter([])}
            onClose={() => setTypePickerOpen(false)}
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

  return (
    <AppShell
      title={activeScheme ? `Horizon · ${activeScheme.label}` : "Horizon"}
      headerStartActions={headerStartActions}
    >
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

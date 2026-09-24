"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { EyeOff, Target, Tag } from "lucide-react";
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
import { TypePicker } from "@/components/brainstorm/TypePicker";
import { TypeFilterPicker } from "@/components/shared/TypeFilterPicker";
import { Idea, TermValue, IdeaNode, IdeaType } from "@/lib/types";
import { TYPE_BADGE } from "@/lib/constants";
import { useClassifications } from "@/hooks/useClassifications";
import {
  STORAGE_KEYS,
  TreeOverrideState,
  readRawString,
  writeRawString,
  readTreeOverrides,
  writeTreeOverrides,
} from "@/lib/storage";

const HORIZONS: { key: TermValue; label: string }[] = [
  { key: "short", label: "Short term" },
  { key: "medium", label: "Medium term" },
  { key: "long", label: "Long term" },
];

/** Grouping keys for the Horizon lens over the Term classification. */
type TermGroupKey = TermValue | "unclassified";

const COLUMNS: { key: TermGroupKey; label: string }[] = [
  ...HORIZONS,
  { key: "unclassified", label: "Unclassified" },
];

function isTermValue(v: string | null | undefined): v is TermValue {
  return v === "short" || v === "medium" || v === "long";
}

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
  // Every root is in scope: Term-classified roots group by value, the rest
  // form the explicit unclassified group (never hidden, never defaulted).
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
}: {
  label: string;
  onAdd: (text: string, type?: IdeaType) => Promise<void>;
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
  const [activeTab, setActiveTab] = useState<TermGroupKey>("short");
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
  const horizonParam = searchParams.get("horizon") as TermGroupKey | null;

  const termById = useMemo(() => {
    const termScheme = schemes.find((s) => s.key === "term");
    const map = new Map<string, TermValue>();
    if (!termScheme) return map;
    const valueByOptionId = new Map(
      classificationOptions
        .filter((o) => o.scheme_id === termScheme.id)
        .map((o) => [o.id, o.value]),
    );
    for (const c of classifications) {
      if (c.scheme_id !== termScheme.id) continue;
      const v = valueByOptionId.get(c.option_id);
      if (isTermValue(v)) map.set(c.idea_id, v);
    }
    return map;
  }, [schemes, classificationOptions, classifications]);

  const termOf = useCallback(
    (ideaId: string): TermValue | null => termById.get(ideaId) ?? null,
    [termById],
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

  const treesByHorizon = useMemo(() => {
    const grouped: Record<TermGroupKey, IdeaNode[]> = {
      short: [],
      medium: [],
      long: [],
      unclassified: [],
    };
    for (const node of allTreeNodes) {
      grouped[termOf(node.id) ?? "unclassified"].push(node);
    }
    for (const key of Object.keys(grouped) as TermGroupKey[]) {
      grouped[key].sort((a, b) => {
        const aPriority = a.priority_order ?? Infinity;
        const bPriority = b.priority_order ?? Infinity;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.sort_order - b.sort_order;
      });
    }
    return grouped;
  }, [allTreeNodes, termOf]);

  const filteredTreesByHorizon = useMemo(() => {
    let result = treesByHorizon;
    if (focusOnly) {
      const focused: Record<TermGroupKey, IdeaNode[]> = {
        short: [],
        medium: [],
        long: [],
        unclassified: [],
      };
      for (const key of Object.keys(result) as TermGroupKey[]) {
        focused[key] = filterTreeByFocus(result[key], ideas);
      }
      result = focused;
    }
    if (typeFilter.length > 0) {
      const typed: Record<TermGroupKey, IdeaNode[]> = {
        short: [],
        medium: [],
        long: [],
        unclassified: [],
      };
      for (const key of Object.keys(result) as TermGroupKey[]) {
        typed[key] = filterTreeByType(result[key], typeFilter);
      }
      result = typed;
    }
    return result;
  }, [treesByHorizon, focusOnly, typeFilter, ideas]);

  const handleSetTerm = async (id: string, term: TermValue | null) => {
    const previous = termOf(id);
    await setClassification(id, "term", term);
    registerUndo({
      label: "Term updated",
      run: async () => {
        await setClassification(id, "term", previous);
      },
    });
  };

  const handleAdd = (term: TermValue | null) => {
    return async (text: string, type?: IdeaType): Promise<void> => {
      const id = await createIdea(text, null, "bottom", {
        type: type ?? "task",
        status: "draft",
      });
      if (id && term) {
        await setClassification(id, "term", term);
      }
    };
  };

  useEffect(() => {
    if (
      horizonParam &&
      (["short", "medium", "long", "unclassified"] as TermGroupKey[]).includes(horizonParam)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync tab from URL param
      setActiveTab(horizonParam);
    }
  }, [horizonParam]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const currentIdeas = ideasRef.current;
    const idea = currentIdeas.find((i) => i.id === highlightId);
    if (idea) setActiveTab(termOf(idea.id) ?? "unclassified");
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
  }, [highlightId, loading, searchParams, router, termOf]);

  if (loading || classificationsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading horizon...</div>
      </div>
    );
  }

  const renderColumn = (h: { key: TermGroupKey; label: string }) => {
    const nodes = filteredTreesByHorizon[h.key];
    return (
      <div className="glass-card flex min-w-0 flex-1 flex-col rounded-2xl">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/5">
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{h.label}</span>
          <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-gray-400 dark:bg-white/[0.06] dark:text-gray-500">
            {nodes.length}
          </span>
        </div>

        <div className="max-h-[calc(100vh-220px)] min-h-[120px] flex-1 overflow-y-auto">
          <HorizonTree
            nodes={nodes}
            ideas={ideas}
            termValue={h.key === "unclassified" ? null : h.key}
            onSetTerm={handleSetTerm}
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
            onToggleInFocus={ideasHook.toggleInFocus}
            emptyMessage={
              <p className="px-4 py-6 text-center text-xs text-gray-400 italic dark:text-gray-500">
                No items yet
              </p>
            }
          />
        </div>

        <RootAddInput label={h.label} onAdd={handleAdd(h.key === "unclassified" ? null : h.key)} />
      </div>
    );
  };

  const headerStartActions = (
    <>
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
    <AppShell title="Horizon" headerStartActions={headerStartActions}>
      <UndoBar undoAction={undoAction} onUndo={() => void handleUndo()} onDismiss={clearUndo} />

      {/* Mobile tab bar */}
      <div className="sticky top-[53px] z-10 mb-4 flex gap-1 rounded-xl bg-black/[0.03] p-1 md:hidden dark:bg-white/[0.04]">
        {COLUMNS.map((h) => (
          <button
            key={h.key}
            onClick={() => setActiveTab(h.key)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeTab === h.key
                ? "bg-violet-100/80 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>

      {/* Desktop: columns stacked vertically */}
      <div className="hidden gap-5 md:flex md:flex-col">
        {COLUMNS.map((h, i) => (
          <motion.div
            key={h.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: "easeOut" }}
            className="min-w-0"
          >
            {renderColumn(h)}
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
            {renderColumn(COLUMNS.find((h) => h.key === activeTab)!)}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

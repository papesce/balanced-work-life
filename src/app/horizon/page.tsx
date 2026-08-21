"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EyeOff } from "lucide-react";
import { useIdeas, type CreateIdeaPosition } from "@/hooks/useIdeas";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useUndoAction } from "@/lib/tasks/undo";
import { filterTreeBySearch } from "@/lib/ideaTreeFilters";
import { buildTree as buildTreeGeneric } from "@/components/tree/buildTree";
import { AppShell } from "@/components/AppShell";
import { UndoBar } from "@/components/shared/UndoBar";
import { QuickAddInput } from "@/components/timeline/QuickAddInput";
import { HorizonTree } from "@/components/horizon/HorizonTree";
import { TypePicker } from "@/components/brainstorm/TypePicker";
import { Idea, IdeaHorizon, IdeaNode, IdeaType } from "@/lib/types";
import {
  STORAGE_KEYS,
  TreeOverrideState,
  readTreeOverrides,
  writeTreeOverrides,
} from "@/lib/storage";

const HORIZONS: { key: IdeaHorizon; label: string }[] = [
  { key: "short", label: "Short term" },
  { key: "medium", label: "Medium term" },
  { key: "long", label: "Long term" },
];

const ACTIVE_STATUSES = new Set(["draft", "planned", "in_progress", "scheduled"]);

function buildFilteredTree(ideas: Idea[], collapsedIds: Set<string>): IdeaNode[] {
  const activeIdeas = ideas.filter((i) => ACTIVE_STATUSES.has(i.status));

  const activeIds = new Set(activeIdeas.map((i) => i.id));
  const childIds = new Set(
    activeIdeas.filter((i) => i.parent_id && activeIds.has(i.parent_id)).map((i) => i.id),
  );
  const rootIds = activeIdeas
    .filter((i) => i.horizon != null && !childIds.has(i.id))
    .map((i) => i.id);
  const rootSet = new Set(rootIds);

  const included = activeIdeas.filter((i) => {
    if (rootSet.has(i.id)) return true;
    let cur = i;
    while (cur.parent_id && activeIds.has(cur.parent_id)) {
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

function getDescendantIdeaIds(rootId: string, ideas: Idea[]): Set<string> {
  const ids = new Set<string>();
  const collect = (id: string) => {
    ids.add(id);
    ideas.filter((idea) => idea.parent_id === id).forEach((child) => collect(child.id));
  };
  collect(rootId);
  return ids;
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  idea: {
    label: "Idea",
    className: "bg-orange-100/80 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  },
  objective: {
    label: "Objective",
    className: "bg-purple-100/80 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  },
  project: {
    label: "Project",
    className: "bg-blue-100/80 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  initiative: {
    label: "Initiative",
    className: "bg-violet-100/80 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  },
  task: {
    label: "Task",
    className: "bg-gray-100/80 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400",
  },
};

function RootAddInput({
  horizon,
  onAdd,
}: {
  horizon: IdeaHorizon;
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
          placeholder={`+ Add to ${horizon}...`}
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
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const linksHook = useIdeaLinks();
  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();
  const [activeTab, setActiveTab] = useState<IdeaHorizon>("short");
  const [overrides, setOverrides] = useState<Map<string, TreeOverrideState>>(() =>
    readTreeOverrides(STORAGE_KEYS.horizonTreeOverrides),
  );
  const [search, setSearch] = useState("");
  const [hideClosed, setHideClosed] = useState(false);

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
    const deletedIds = getDescendantIdeaIds(id, ideasHook.ideas);
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
    const hasSearch = search.trim().length > 0;

    const nodeHasSearchMatch = (ideaId: string): boolean => {
      const idea = ideas.find((i) => i.id === ideaId);
      if (!idea) return false;
      const q = search.toLowerCase();
      if (idea.text.toLowerCase().includes(q)) return true;
      return ideas.some((child) => child.parent_id === ideaId && nodeHasSearchMatch(child.id));
    };

    for (const id of parentIds) {
      const override = overrides.get(id);
      if (override === "expanded") continue;
      if (hasSearch && nodeHasSearchMatch(id)) continue;
      collapsed.add(id);
    }
    return collapsed;
  }, [ideas, overrides, search]);

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

  const allTreeNodes = useMemo(() => buildFilteredTree(ideas, collapsedIds), [ideas, collapsedIds]);

  const treesByHorizon = useMemo(() => {
    const grouped: Record<IdeaHorizon, IdeaNode[]> = { short: [], medium: [], long: [] };
    for (const node of allTreeNodes) {
      if (node.horizon && grouped[node.horizon]) {
        grouped[node.horizon].push(node);
      }
    }
    for (const key of Object.keys(grouped) as IdeaHorizon[]) {
      grouped[key].sort((a, b) => {
        const aPriority = a.priority_order ?? Infinity;
        const bPriority = b.priority_order ?? Infinity;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.sort_order - b.sort_order;
      });
    }
    return grouped;
  }, [allTreeNodes]);

  const originalTreeLengths = useMemo(() => {
    const lengths: Record<IdeaHorizon, number> = { short: 0, medium: 0, long: 0 };
    for (const key of Object.keys(treesByHorizon) as IdeaHorizon[]) {
      lengths[key] = treesByHorizon[key].length;
    }
    return lengths;
  }, [treesByHorizon]);

  const filteredTreesByHorizon = useMemo(() => {
    if (!search.trim()) return treesByHorizon;
    const filtered: Record<IdeaHorizon, IdeaNode[]> = { short: [], medium: [], long: [] };
    for (const key of Object.keys(treesByHorizon) as IdeaHorizon[]) {
      filtered[key] = filterTreeBySearch(treesByHorizon[key], search);
    }
    return filtered;
  }, [treesByHorizon, search]);

  const handleAdd = (horizon: IdeaHorizon) => {
    return async (text: string, type?: IdeaType): Promise<void> => {
      await createIdea(text, null, "bottom", {
        type: type ?? "task",
        status: "draft",
        horizon,
      });
    };
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading horizon...</div>
      </div>
    );
  }

  const renderColumn = (h: { key: IdeaHorizon; label: string }) => {
    const nodes = filteredTreesByHorizon[h.key];
    const wasOriginallyEmpty = originalTreeLengths[h.key] === 0;
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
            emptyMessage={
              <p className="px-4 py-6 text-center text-xs text-gray-400 italic dark:text-gray-500">
                {wasOriginallyEmpty ? "No items yet" : "No matches"}
              </p>
            }
          />
        </div>

        <RootAddInput horizon={h.key} onAdd={handleAdd(h.key)} />
      </div>
    );
  };

  const headerStartActions = (
    <>
      <input
        type="text"
        placeholder="Search\u2026"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-32 rounded-lg border border-black/10 bg-white/60 px-3 py-1.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-indigo-500 sm:w-44 md:w-56 dark:border-white/10 dark:bg-gray-800/60 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-indigo-400"
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
    </>
  );

  return (
    <AppShell title="Horizon" headerStartActions={headerStartActions}>
      <UndoBar undoAction={undoAction} onUndo={() => void handleUndo()} onDismiss={clearUndo} />

      {/* Mobile tab bar */}
      <div className="sticky top-[53px] z-10 mb-4 flex gap-1 rounded-xl bg-black/[0.03] p-1 md:hidden dark:bg-white/[0.04]">
        {HORIZONS.map((h) => (
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

      {/* Desktop: three columns stacked vertically */}
      <div className="hidden gap-5 md:flex md:flex-col">
        {HORIZONS.map((h, i) => (
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
            {renderColumn(HORIZONS.find((h) => h.key === activeTab)!)}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

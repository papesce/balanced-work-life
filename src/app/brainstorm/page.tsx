"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useIdeas, type CreateIdeaPosition } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { AppShell } from "@/components/AppShell";
import { IdeaTree } from "@/components/brainstorm/IdeaTree";
import { BrainstormToolbar } from "@/components/brainstorm/BrainstormToolbar";
import { GraphView } from "@/components/brainstorm/GraphView";
import { Idea, LinkType } from "@/lib/types";
import type { IdeasScope } from "@/hooks/useIdeas";

type UndoAction = {
  label: string;
  run: () => Promise<void>;
};

function getDescendantIdeaIds(rootId: string, ideas: Idea[]): Set<string> {
  const ids = new Set<string>();
  const collect = (id: string) => {
    ids.add(id);
    ideas.filter((idea) => idea.parent_id === id).forEach((child) => collect(child.id));
  };
  collect(rootId);
  return ids;
}

export default function BrainstormPage() {
  const [timeScope, setTimeScope] = useState<IdeasScope>("this_month");
  const ideasHook = useIdeas({ scope: timeScope });
  const linksHook = useIdeaLinks();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const [viewMode, setViewMode] = useState<"tree" | "graph">("tree");
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

  const [search, setSearch] = useState("");
  const [showType, setShowType] = useState(true);
  const [showArea, setShowArea] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState<{
    nodeId: string;
    parentId: string | null;
    position: "child" | "top" | "bottom";
    depth: number;
  } | null>(null);
  const [showToday, setShowToday] = useState(false);
  const [hideClosed, setHideClosed] = useState(false);

  const hasLinks = linksHook.links.length > 0;

  const registerUndo = (undo: UndoAction) => {
    setUndoAction(undo);
  };

  const clearUndo = () => {
    setUndoAction(null);
  };

  const handleAddRoot = async () => {
    const id = await createIdea("", null, "top");
    if (id) {
      setSelectedId(id);
      setEditingId(id);
    }
  };

  const createIdea = async (
    text: string,
    parentId?: string | null,
    position?: CreateIdeaPosition,
  ): Promise<string> => {
    const id = await ideasHook.createIdea(text, parentId, position);
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

  const moveIdea = async (id: string, newParentId: string | null, newSortOrder: number) => {
    const previous = ideasHook.ideas.find((idea) => idea.id === id);
    await ideasHook.moveIdea(id, newParentId, newSortOrder);
    if (!previous) return;

    registerUndo({
      label: "Idea moved",
      run: async () => {
        await ideasHook.moveIdea(id, previous.parent_id, previous.sort_order);
      },
    });
  };

  const createLink = async (
    sourceId: string,
    targetId: string,
    linkType: LinkType,
  ): Promise<string> => {
    const id = await linksHook.createLink(sourceId, targetId, linkType);
    if (id) {
      registerUndo({
        label: "Link created",
        run: async () => {
          await linksHook.deleteLink(id);
        },
      });
    }
    return id;
  };

  const deleteLink = async (id: string) => {
    const deletedLink = linksHook.links.find((link) => link.id === id);
    await linksHook.deleteLink(id);
    if (!deletedLink) return;

    registerUndo({
      label: "Link deleted",
      run: async () => {
        await linksHook.restoreLinks([deletedLink]);
      },
    });
  };

  const markDone = async (id: string) => {
    const previous = ideasHook.ideas.find((idea) => idea.id === id);
    await ideasHook.markDone(id);
    if (!previous) return;

    registerUndo({
      label: "Idea completed",
      run: async () => {
        await ideasHook.updateIdea(id, {
          status: previous.status,
          completed_at: previous.completed_at,
        });
      },
    });
  };

  const markUndone = async (id: string) => {
    const previous = ideasHook.ideas.find((idea) => idea.id === id);
    await ideasHook.markUndone(id);
    if (!previous) return;

    registerUndo({
      label: "Idea reopened",
      run: async () => {
        await ideasHook.updateIdea(id, {
          status: previous.status,
          completed_at: previous.completed_at,
        });
      },
    });
  };

  const scheduleIdea = async (id: string, date: string | null) => {
    const previous = ideasHook.ideas.find((idea) => idea.id === id);
    await ideasHook.scheduleIdea(id, date);
    if (!previous) return;

    registerUndo({
      label: date ? "Idea scheduled" : "Schedule cleared",
      run: async () => {
        await ideasHook.updateIdea(id, { scheduled_date: previous.scheduled_date });
      },
    });
  };

  const handleUndo = async () => {
    if (!undoAction) return;
    const action = undoAction;
    setUndoAction(null);
    await action.run();
  };

  if (ideasHook.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading...</div>
      </div>
    );
  }

  const headerStartActions = (
    <BrainstormToolbar
      search={search}
      setSearch={setSearch}
      showType={showType}
      setShowType={setShowType}
      showArea={showArea}
      setShowArea={setShowArea}
      showToday={showToday}
      setShowToday={setShowToday}
      hideClosed={hideClosed}
      setHideClosed={setHideClosed}
      onAddRoot={handleAddRoot}
      expandAll={ideasHook.expandAll}
      collapseAll={ideasHook.collapseAll}
    />
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        <button
          onClick={() => setTimeScope("this_month")}
          className={`toolbar-btn ${timeScope === "this_month" ? "toolbar-btn--accent" : ""}`}
          title="Only load ideas scheduled this month or unscheduled and active"
        >
          This month
        </button>
        <button
          onClick={() => setTimeScope("all")}
          className={`toolbar-btn ${timeScope === "all" ? "toolbar-btn--accent" : ""}`}
          title="Load every idea"
        >
          All
        </button>
      </div>
      <span className="text-gray-200">|</span>
      <div className="flex gap-1">
        <button
          onClick={() => setViewMode("tree")}
          className={`toolbar-btn ${viewMode === "tree" ? "toolbar-btn--accent" : ""}`}
        >
          Tree
        </button>
        <button
          onClick={() => setViewMode("graph")}
          disabled={!hasLinks}
          className={`toolbar-btn ${
            !hasLinks
              ? "cursor-not-allowed opacity-40"
              : viewMode === "graph"
                ? "toolbar-btn--accent"
                : ""
          }`}
          title={!hasLinks ? "Link two ideas to unlock" : ""}
        >
          Graph
        </button>
      </div>
    </div>
  );

  return (
    <AppShell
      title="Brainstorm"
      headerActions={headerActions}
      headerStartActions={headerStartActions}
      fullWidth={viewMode === "graph"}
    >
      {undoAction && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="glass-card-strong fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-amber-200/40 px-4 py-2.5 shadow-lg dark:border-amber-700/30"
        >
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {undoAction.label}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleUndo}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100/60 dark:text-amber-400 dark:hover:bg-amber-900/20"
            >
              Undo
            </button>
            <button
              onClick={clearUndo}
              aria-label="Dismiss undo"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-600 transition-colors hover:bg-amber-100/60 dark:text-amber-400 dark:hover:bg-amber-900/20"
            >
              <span className="text-sm">×</span>
            </button>
          </div>
        </motion.div>
      )}
      {viewMode === "tree" ? (
        <IdeaTree
          tree={ideasHook.tree}
          ideas={ideasHook.ideas}
          links={linksHook.links}
          scope={timeScope}
          createIdea={createIdea}
          updateIdea={updateIdea}
          deleteIdea={deleteIdea}
          moveIdea={moveIdea}
          toggleCollapse={ideasHook.toggleCollapse}
          expandIdea={ideasHook.expandIdea}
          onCreateLink={createLink}
          onDeleteLink={deleteLink}
          onMarkDone={markDone}
          onMarkUndone={markUndone}
          onSchedule={scheduleIdea}
          allTags={tagsHook.tags}
          getTagsForIdea={taskTagsHook.getTagsForIdea}
          onAddTag={taskTagsHook.addTagToTask}
          onRemoveTag={taskTagsHook.removeTagFromTask}
          onCreateTag={tagsHook.createTag}
          search={search}
          showType={showType}
          showArea={showArea}
          editingId={editingId}
          setEditingId={setEditingId}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          composing={composing}
          setComposing={setComposing}
          showToday={showToday}
          hideClosed={hideClosed}
        />
      ) : (
        <GraphView
          ideas={ideasHook.ideas}
          links={linksHook.links}
          onNodeDoubleClick={() => {
            setViewMode("tree");
          }}
        />
      )}
    </AppShell>
  );
}

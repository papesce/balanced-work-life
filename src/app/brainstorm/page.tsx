"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useIdeas } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { AppShell } from "@/components/AppShell";
import { IdeaTree } from "@/components/brainstorm/IdeaTree";
import { GraphView } from "@/components/brainstorm/GraphView";
import { Idea, LinkType } from "@/lib/types";

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
  const ideasHook = useIdeas();
  const linksHook = useIdeaLinks();
  const [viewMode, setViewMode] = useState<"tree" | "graph">("tree");
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

  const hasLinks = linksHook.links.length > 0;

  const registerUndo = (undo: UndoAction) => {
    setUndoAction(undo);
  };

  const clearUndo = () => {
    setUndoAction(null);
  };

  const createIdea = async (
    text: string,
    parentId?: string | null,
    position?: "top" | "bottom"
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
    linkType: LinkType
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
        await ideasHook.updateIdea(id, { status: previous.status, completed_at: previous.completed_at });
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
        await ideasHook.updateIdea(id, { status: previous.status, completed_at: previous.completed_at });
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading...</div>
      </div>
    );
  }

  const headerActions = (
    <div className="flex gap-1">
      <button
        onClick={() => setViewMode("tree")}
        className={`focus-button ${viewMode === "tree" ? "active" : ""}`}
      >
        Tree
      </button>
      <button
        onClick={() => setViewMode("graph")}
        disabled={!hasLinks}
        className={`focus-button ${
          !hasLinks
            ? "opacity-40 cursor-not-allowed"
            : viewMode === "graph"
            ? "active"
            : ""
        }`}
        title={!hasLinks ? "Link two ideas to unlock" : ""}
      >
        Graph
      </button>
    </div>
  );

  return (
    <AppShell title="Brainstorm" headerActions={headerActions} fullWidth={viewMode === "graph"}>
      {undoAction && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 flex items-center justify-between gap-3 rounded-[16px] glass-card border-amber-200/40 dark:border-amber-700/30 px-4 py-2.5"
        >
          <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">{undoAction.label}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleUndo}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 rounded-lg px-2.5 py-1 transition-colors"
            >
              Undo
            </button>
            <button
              onClick={clearUndo}
              aria-label="Dismiss undo"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 transition-colors"
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
          createIdea={createIdea}
          updateIdea={updateIdea}
          deleteIdea={deleteIdea}
          moveIdea={moveIdea}
          toggleCollapse={ideasHook.toggleCollapse}
          expandIdea={ideasHook.expandIdea}
          expandAll={ideasHook.expandAll}
          collapseAll={ideasHook.collapseAll}
          onCreateLink={createLink}
          onDeleteLink={deleteLink}
          onMarkDone={markDone}
          onMarkUndone={markUndone}
          onSchedule={scheduleIdea}
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

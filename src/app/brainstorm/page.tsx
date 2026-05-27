"use client";

import { useState } from "react";
import { useIdeas } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useTasks } from "@/hooks/useTasks";
import { usePromoteIdea } from "@/hooks/usePromoteIdea";
import { AppShell } from "@/components/AppShell";
import { IdeaTree } from "@/components/brainstorm/IdeaTree";
import { GraphView } from "@/components/brainstorm/GraphView";
import { ConflictDialog } from "@/components/brainstorm/ConflictDialog";
import { TimeBucket } from "@/lib/types";

export default function BrainstormPage() {
  const ideasHook = useIdeas();
  const linksHook = useIdeaLinks();
  const tasksHook = useTasks();
  const { promote, conflictState, resolveConflict, dismissConflict } = usePromoteIdea(
    tasksHook.activeTasksByIdeaId,
    tasksHook.createTask,
    tasksHook.updateTask
  );
  const [viewMode, setViewMode] = useState<"tree" | "graph">("tree");

  const hasLinks = linksHook.links.length > 0;

  const handlePromote = (ideaId: string, bucket: TimeBucket) => {
    const idea = ideasHook.ideas.find((i) => i.id === ideaId);
    if (idea) promote(idea, bucket);
  };

  if (ideasHook.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  const headerActions = (
    <div className="flex gap-1">
      <button
        onClick={() => setViewMode("tree")}
        className={`text-xs px-2.5 py-1 rounded-full border ${
          viewMode === "tree"
            ? "bg-white border-indigo-300 text-indigo-700 font-medium"
            : "bg-gray-100 border-gray-200 text-gray-500"
        }`}
      >
        Tree
      </button>
      <button
        onClick={() => setViewMode("graph")}
        disabled={!hasLinks}
        className={`text-xs px-2.5 py-1 rounded-full border ${
          !hasLinks
            ? "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed"
            : viewMode === "graph"
            ? "bg-white border-indigo-300 text-indigo-700 font-medium"
            : "bg-gray-100 border-gray-200 text-gray-500"
        }`}
        title={!hasLinks ? "Link two ideas to unlock" : ""}
      >
        Graph
      </button>
    </div>
  );

  return (
    <AppShell title="Brainstorm" headerActions={headerActions} fullWidth={viewMode === "graph"}>
      {viewMode === "tree" ? (
        <IdeaTree
          tree={ideasHook.tree}
          ideas={ideasHook.ideas}
          links={linksHook.links}
          activeTasksByIdeaId={tasksHook.activeTasksByIdeaId}
          createIdea={ideasHook.createIdea}
          updateIdea={ideasHook.updateIdea}
          deleteIdea={ideasHook.deleteIdea}
          moveIdea={ideasHook.moveIdea}
          toggleCollapse={ideasHook.toggleCollapse}
          expandAll={ideasHook.expandAll}
          collapseAll={ideasHook.collapseAll}
          onCreateLink={linksHook.createLink}
          onDeleteLink={linksHook.deleteLink}
          onPromote={handlePromote}
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
      {conflictState && (
        <ConflictDialog
          existingTask={conflictState.existingTask}
          targetBucket={conflictState.targetBucket}
          onMove={() => resolveConflict("move")}
          onCancel={dismissConflict}
        />
      )}
    </AppShell>
  );
}

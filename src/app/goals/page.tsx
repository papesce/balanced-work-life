"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { IdeaTree } from "@/components/brainstorm/IdeaTree";
import { BrainstormBreadcrumb } from "@/components/brainstorm/BrainstormBreadcrumb";
import { useIdeas } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useClassifications } from "@/hooks/useClassifications";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { groupKeyOf, useLens } from "@/components/lens";
import { getChildCount } from "@/lib/ideaTreeFocus";
import { hasAnyEffects } from "@/lib/linkEffects";
import { useCompletionEffects } from "@/stores/feedbackStore";
import { LinkedEffectsReveal } from "@/components/shared/LinkedEffectsReveal";
import { useUndoAction } from "@/lib/tasks/undo";
import { UndoBar } from "@/components/shared/UndoBar";
import { GoalListView } from "@/components/goals/GoalListView";
import { useGoalMutations } from "@/hooks/useGoalMutations";
import { useGoalSelection } from "@/hooks/useGoalSelection";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import type { Idea } from "@/lib/types";

export default function GoalsPage() {
  const [hideCompleted, setHideCompleted] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "open">("open");

  const ideasHook = useIdeas({ scope: "all" });
  const linksHook = useIdeaLinks();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const classifications = useClassifications();
  const lensKey = useUiPrefsStore((s) => s.goalsLens);
  const setPrefs = useUiPrefsStore((s) => s.set);

  const { columns: goalColumns, valueOf: goalValueOf } = useLens({
    schemes: classifications.schemes,
    classificationOptions: classifications.options,
    classifications: classifications.classifications,
    lensKey,
  });
  const lensTabs = useMemo(
    () =>
      classifications.schemes
        .filter((scheme) =>
          ["term", "nnl", "moscow", "priority", "attention", "when", "effort", "impact"].includes(
            scheme.key,
          ),
        )
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((scheme) => ({
          key: scheme.key,
          label: scheme.key === "term" ? "Horizon" : scheme.label,
        })),
    [classifications.schemes],
  );
  const { selectedId, handleSelect, visibleGoals, selectedGoal, breadcrumbChain } =
    useGoalSelection({
      ideas: ideasHook.ideas,
      loading: ideasHook.loading,
      expandIdea: ideasHook.expandIdea,
      statusFilter,
      hideCompleted,
      setHideCompleted,
      setStatusFilter,
    });

  const groupedGoals = useMemo(() => {
    const grouped = new Map<string, Idea[]>();
    for (const goal of visibleGoals) {
      const key = groupKeyOf(goalValueOf(goal.id));
      const group = grouped.get(key) ?? [];
      group.push(goal);
      grouped.set(key, group);
    }
    return grouped;
  }, [visibleGoals, goalValueOf]);

  const [showType] = useState(true);
  const [showArea] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [composing, setComposing] = useState<{
    nodeId: string;
    parentId: string | null;
    position: "child" | "top" | "bottom";
    depth: number;
  } | null>(null);
  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();
  const { completionEffects, setCompletionEffects } = useCompletionEffects();

  const {
    createIdea,
    updateIdea,
    deleteIdea,
    moveIdea,
    createParentAndMove,
    createLink,
    deleteLink,
    markDone,
    markUndone,
    scheduleIdea,
  } = useGoalMutations({
    ideasApi: ideasHook,
    linksApi: linksHook,
    registerUndo,
    setCompletionEffects,
    onDeleteIds: (deletedIds) => {
      if (selectedId && deletedIds.has(selectedId)) handleSelect(null);
    },
  });

  const handleAddTask = async () => {
    if (!selectedId) return;
    const id = await createIdea("", selectedId, "bottom", { type: "task", status: "draft" });
    if (id) {
      ideasHook.expandIdea(selectedId);
      setSelectedTreeId(id);
      setEditingId(id);
    }
  };

  const handleCreateGoal = async (text: string) => {
    const id = await createIdea(text, null, "bottom", { type: "objective", status: "draft" });
    if (!id) return false;
    handleSelect(id);
    return true;
  };

  if (ideasHook.loading || classifications.isLoading) {
    return (
      <AppShell title="Goals">
        <div className="flex justify-center py-20">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </AppShell>
    );
  }

  // Detail view — focused goal tree
  if (selectedId && selectedGoal) {
    return (
      <AppShell
        title={selectedGoal.text || "Untitled goal"}
        headerStartActions={
          <button
            onClick={() => handleSelect(null)}
            className="toolbar-btn flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> Back
          </button>
        }
        headerActions={
          <button
            onClick={handleAddTask}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
          >
            <Plus size={13} /> Add task
          </button>
        }
      >
        {breadcrumbChain.length > 0 && (
          <div className="mb-3">
            <BrainstormBreadcrumb
              chain={breadcrumbChain}
              focused={selectedGoal}
              onSelect={(id) => handleSelect(id)}
            />
          </div>
        )}

        <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
          <span className="capitalize">{selectedGoal.status.replace("_", " ")}</span>
          <span>·</span>
          <span>{getChildCount(selectedGoal.id, ideasHook.ideas)} tasks</span>
        </div>

        <IdeaTree
          tree={ideasHook.tree}
          ideas={ideasHook.ideas}
          links={linksHook.links}
          scope="all"
          createIdea={createIdea}
          updateIdea={updateIdea}
          deleteIdea={deleteIdea}
          moveIdea={moveIdea}
          onCreateParent={createParentAndMove}
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
          search=""
          showType={showType}
          showArea={showArea}
          editMode="view"
          editingId={editingId}
          setEditingId={setEditingId}
          selectedId={selectedTreeId}
          setSelectedId={setSelectedTreeId}
          composing={composing}
          setComposing={setComposing}
          showToday={false}
          hideClosed={false}
          hideCompleted={false}
          hideDeferred={false}
          focusedId={selectedId}
          onFocus={(id) => handleSelect(id)}
          cardMode={false}
        />
        {completionEffects && hasAnyEffects(completionEffects.effects) && (
          <div className="mt-4">
            <LinkedEffectsReveal
              effects={completionEffects.effects}
              completedText={completionEffects.completedText}
              onClose={() => setCompletionEffects(null)}
            />
          </div>
        )}

        <UndoBar undoAction={undoAction} onUndo={handleUndo} onDismiss={clearUndo} />
      </AppShell>
    );
  }

  return (
    <GoalListView
      visibleGoals={visibleGoals}
      allIdeas={ideasHook.ideas}
      columns={goalColumns}
      groupedGoals={groupedGoals}
      lensKey={lensKey}
      lensTabs={lensTabs}
      statusFilter={statusFilter}
      hideCompleted={hideCompleted}
      undoAction={undoAction}
      onCreateGoal={handleCreateGoal}
      onLensChange={(key) => setPrefs({ goalsLens: key })}
      onStatusFilterChange={setStatusFilter}
      onToggleHideCompleted={() => setHideCompleted((v) => !v)}
      onSelect={handleSelect}
      onUndo={handleUndo}
      onDismissUndo={clearUndo}
    />
  );
}

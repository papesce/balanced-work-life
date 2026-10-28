"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  ProjectDetailActions,
  ProjectDetailStartActions,
  ProjectDetailTop,
} from "@/components/projects/ProjectDetailHeader";
import { ProjectDetailView } from "@/components/projects/ProjectDetailView";
import { ProjectTasksPane } from "@/components/projects/ProjectTasksPane";
import { ProjectPathCanvas } from "@/components/projects/ProjectPathsTab";
import { getGroupSchemeOptions } from "@/lib/groupSchemeOptions";
import type { ProjectsPageModel } from "@/hooks/useProjectsPage";
import { useProjectPaths } from "@/hooks/useProjectPaths";

/**
 * The focused-project detail view (AppShell + breadcrumb top + split/paths
 * detail). Reads everything off the shared page model and derives the
 * detail-only values (stats, next, focused node, tree props).
 */
export function ProjectDetailLayout({ model }: { model: ProjectsPageModel }) {
  const {
    selectedProject,
    selectedId,
    focusedId,
    setFocusedId,
    unpathedOnly,
    handleSelect,
    breadcrumbChain,
    isNarrow,
    effectiveMode,
    projectSplitRatio,
    canvasApi,
    handleCanvasApi,
    handleAddToPath,
    handleListResize,
    setViewMode,
    ideasHook,
    linksHook,
    tagsHook,
    taskTagsHook,
    membership,
    openNotes,
    schemes,
    statOf,
    onToggleUnpathedOnly,
    onToggleDetailHideCompleted,
    onToggleDetailHideClosed,
    editingId,
    setEditingId,
    selectedTreeId,
    setSelectedTreeId,
    composing,
    setComposing,
    showType,
    showArea,
    titleEditing,
    titleDraft,
    setTitleEditing,
    setTitleDraft,
    commitTitleRename,
    projectTasks,
    pathedIds,
    groupedForest,
    detailLens,
    unpathedCount,
    tasksGroupBy,
    completionEffects,
    undoAction,
    onGroupByChange,
    handleComposerAdd,
    handleAddTaskInGroup,
    actions,
  } = model;
  const [hoveredPathTaskId, setHoveredPathTaskId] = useState<string | null>(null);

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
    setCompletionEffects,
    clearUndo,
    handleUndo,
  } = actions;

  const composerParent = focusedId
    ? (ideasHook.ideas.find((i) => i.id === focusedId) ?? null)
    : null;
  const projectPaths = useProjectPaths(selectedProject.id);
  const selectedPathTaskIds = useMemo(
    () =>
      canvasApi?.selectedPathId === projectPaths.selectedPathId
        ? canvasApi.placedIds
        : new Set<string>(),
    [canvasApi, projectPaths.selectedPathId],
  );
  useEffect(() => {
    const handleHighlight = (event: Event) => {
      const { ideaId } = (event as CustomEvent<{ ideaId: string | null }>).detail ?? {};
      setHoveredPathTaskId(ideaId && selectedPathTaskIds.has(ideaId) ? ideaId : null);
    };
    window.addEventListener("path-task-highlight", handleHighlight);
    return () => window.removeEventListener("path-task-highlight", handleHighlight);
  }, [selectedPathTaskIds]);

  // Shared IdeaTree props for the detail TASKS pane (single + grouped modes).
  const sharedTreeProps = {
    ideas: ideasHook.ideas,
    links: linksHook.links,
    scope: "all" as const,
    createIdea,
    updateIdea,
    deleteIdea,
    moveIdea,
    onCreateParent: createParentAndMove,
    toggleCollapse: ideasHook.toggleCollapse,
    expandIdea: ideasHook.expandIdea,
    onCreateLink: createLink,
    onDeleteLink: deleteLink,
    onMarkDone: markDone,
    onMarkUndone: markUndone,
    onSchedule: scheduleIdea,
    allTags: tagsHook.tags,
    getTagsForIdea: taskTagsHook.getTagsForIdea,
    onAddTag: taskTagsHook.addTagToTask,
    onRemoveTag: taskTagsHook.removeTagFromTask,
    onCreateTag: tagsHook.createTag,
    search: "",
    showType,
    showArea,
    editMode: "edit" as const,
    editingId,
    setEditingId,
    selectedId: selectedTreeId,
    setSelectedId: setSelectedTreeId,
    composing,
    setComposing,
    showToday: false,
    hideClosed: model.detailHideClosed,
    hideCompleted: model.detailHideCompleted,
    hideDeferred: false,
    pathChipsForIdea: (id: string) => membership.titlesByIdea.get(id) ?? [],
    highlightPathTaskIds: selectedPathTaskIds,
    hoveredPathTaskId,
    onFocus: model.onFocusNode,
    cardMode: false,
    compact: effectiveMode === "split",
    onAddToPath: effectiveMode === "split" ? handleAddToPath : undefined,
    isInPath: model.isInPath,
    pathAddDisabled: !canvasApi?.selectedPathId,
  };
  const groupSchemeOptions = getGroupSchemeOptions(schemes);
  const detailStat = statOf(selectedProject.id);
  const detailNext = detailStat.nextId
    ? (ideasHook.ideas.find((i) => i.id === detailStat.nextId) ?? null)
    : null;
  const detailFocusedIdea = focusedId
    ? (ideasHook.ideas.find((i) => i.id === focusedId) ?? selectedProject)
    : selectedProject;

  return (
    <AppShell
      title=""
      fullWidth
      headerStartActions={
        <ProjectDetailStartActions
          detailHideClosed={model.detailHideClosed}
          detailHideCompleted={model.detailHideCompleted}
          effectiveMode={effectiveMode}
          unpathedCount={unpathedCount}
          unpathedOnly={unpathedOnly}
          onBack={() => handleSelect(null)}
          onToggleHideClosed={onToggleDetailHideClosed}
          onToggleHideCompleted={onToggleDetailHideCompleted}
          onToggleUnpathedOnly={onToggleUnpathedOnly}
        />
      }
      headerActions={
        <ProjectDetailActions
          project={selectedProject}
          effectiveMode={effectiveMode}
          isNarrow={isNarrow}
          onViewModeChange={setViewMode}
          onOpenDetails={() => {
            if (selectedId) openNotes(selectedId);
          }}
        />
      }
    >
      <ProjectDetailTop
        project={selectedProject}
        focusedIdea={detailFocusedIdea}
        breadcrumbChain={breadcrumbChain}
        focusedId={focusedId}
        titleEditing={titleEditing}
        titleDraft={titleDraft}
        directCount={detailStat.direct}
        doneCount={detailStat.done}
        totalCount={detailStat.total}
        nextText={detailNext?.text || null}
        onSelectBreadcrumb={model.onFocusNode}
        onTitleDraftChange={setTitleDraft}
        onCommitTitleRename={() => void commitTitleRename()}
        onCancelTitleEdit={() => setTitleEditing(false)}
        onStartTitleEdit={() => {
          setTitleDraft(selectedProject.text);
          setTitleEditing(true);
        }}
        onBackToRoot={() => setFocusedId(null)}
      />

      <ProjectDetailView
        effectiveMode={effectiveMode}
        isNarrow={isNarrow}
        projectSplitRatio={projectSplitRatio}
        listPane={
          <ProjectTasksPane
            tree={ideasHook.tree}
            treeProps={sharedTreeProps}
            composerParentText={composerParent ? composerParent.text || "untitled" : null}
            suggestIdeas={ideasHook.ideas}
            onComposerAdd={(text) => void handleComposerAdd(text)}
            tasksGroupBy={tasksGroupBy}
            groupSchemeOptions={groupSchemeOptions}
            onGroupByChange={onGroupByChange}
            groupColumns={detailLens?.columns ?? null}
            groupValueOf={detailLens ? detailLens.valueOf : null}
            groupedForest={groupedForest}
            hideIds={unpathedOnly ? pathedIds : undefined}
            focusId={focusedId ?? selectedId ?? ""}
            totalTaskCount={projectTasks.length}
            showFilterCount={effectiveMode === "split"}
            onAddTaskInGroup={(value) => void handleAddTaskInGroup(value)}
          />
        }
        paths={{
          projectId: selectedProject.id,
          paths: projectPaths.paths,
          selectedPathId: projectPaths.selectedPathId,
          onSelectPath: projectPaths.selectPath,
          onCreatePath: projectPaths.createPath,
          onRenamePath: projectPaths.renamePath,
          onUpdatePathStatus: projectPaths.updatePathStatus,
          onDeletePath: projectPaths.deletePath,
        }}
        pathCanvas={
          <ProjectPathCanvas
            pathId={projectPaths.selectedPathId}
            projectId={selectedProject.id}
            tasks={projectTasks}
            fillHeight
            isNarrow={isNarrow}
            onCanvasApi={handleCanvasApi}
          />
        }
        onListResize={handleListResize}
        onViewModeChange={setViewMode}
        completionEffects={completionEffects}
        onCloseEffects={() => setCompletionEffects(null)}
        undoAction={undoAction}
        onUndo={handleUndo}
        onDismissUndo={clearUndo}
      />
    </AppShell>
  );
}

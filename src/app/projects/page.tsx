"use client";

import { useEffect, useState } from "react";
import { useClassifications } from "@/hooks/useClassifications";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import { AppShell } from "@/components/AppShell";
import { useNotes } from "@/contexts/NotesContext";
import { useIdeas } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { useProjectActions } from "@/hooks/useProjectActions";
import { useProjectsDerived } from "@/hooks/useProjectsDerived";
import { useProjectsSelection } from "@/hooks/useProjectsSelection";
import { useProjectsSplit } from "@/hooks/useProjectsSplit";
import { useProjectTreeStore } from "@/stores/projectTreeStore";
import { Idea, Tag } from "@/lib/types";
import { hintForValue } from "@/lib/classificationHelp";
import { ProjectCard } from "@/components/projects/ProjectCard";
import {
  ProjectDetailActions,
  ProjectDetailStartActions,
  ProjectDetailTop,
} from "@/components/projects/ProjectDetailHeader";
import { ProjectDetailView } from "@/components/projects/ProjectDetailView";
import { ProjectTasksPane } from "@/components/projects/ProjectTasksPane";
import { ProjectListView } from "@/components/projects/ProjectListView";
import { usePathMembership } from "@/hooks/usePathMembership";

export default function ProjectsPage() {
  const [hideCompleted, setHideCompleted] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "open">("open");
  const lensKey = useUiPrefsStore((s) => s.projectsLens);
  const unclassifiedExpanded = useUiPrefsStore((s) => s.projectsUnclassifiedExpanded);
  const setPrefs = useUiPrefsStore((s) => s.set);
  // Expandable cards: which projects show inline tasks in list view.
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  // Inline rename (card title + detail header).
  const [renamingCardId, setRenamingCardId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  // Detail-local filters (list filters don't leak into detail).
  const detailHideCompleted = useUiPrefsStore((s) => s.projectsDetailHideCompleted);
  const detailHideClosed = useUiPrefsStore((s) => s.projectsDetailHideClosed);
  const {
    projectSplitRatio,
    isNarrow,
    effectiveMode,
    canvasApi,
    handleCanvasApi,
    handleAddToPath,
    isInPath,
    fitTick,
    handleListResize,
    setViewMode,
  } = useProjectsSplit();

  const ideasHook = useIdeas({ scope: "all" });
  const linksHook = useIdeaLinks();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const {
    selectedId,
    focusedId,
    setFocusedId,
    unpathedOnly,
    setUnpathedOnly,
    handleSelect,
    breadcrumbChain,
    focusRootId,
  } = useProjectsSelection({
    ideas: ideasHook.ideas,
    loading: ideasHook.loading,
    expandIdea: ideasHook.expandIdea,
    setHideCompleted,
    setStatusFilter,
  });
  const membership = usePathMembership(selectedId ?? "");
  const { openNotes } = useNotes();
  const {
    schemes,
    options: classificationOptions,
    classifications,
    setClassification,
  } = useClassifications();

  const actions = useProjectActions({
    ideasHook,
    linksHook,
    onDeleteIds: (deletedIds) => {
      if (selectedId && deletedIds.has(selectedId)) handleSelect(null);
    },
  });
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
    undoAction,
    clearUndo,
    handleUndo,
    registerUndo,
    completionEffects,
    setCompletionEffects,
  } = actions;

  // Shared O(N) tree: computed once per ideas change in the store,
  // not per page render. Feed PowerSync rows in; rows subscribe out.
  const setTreeIdeas = useProjectTreeStore((s) => s.setIdeas);
  const projectTree = useProjectTreeStore((s) => s.tree);
  useEffect(() => {
    setTreeIdeas(ideasHook.ideas);
  }, [ideasHook.ideas, setTreeIdeas]);
  const statOf = (id: string) =>
    projectTree.stats.get(id) ?? { done: 0, total: 0, direct: 0, nextId: null };

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

  const {
    columns,
    valueOf,
    priorityOf,
    visibleProjects,
    groupedProjects,
    handleLensChange,
    lensTabs,
    selectedProject,
    projectTasks,
    pathedIds,
    unpathedCount,
    detailLens,
    groupedForest,
  } = useProjectsDerived({
    ideas: ideasHook.ideas,
    tree: ideasHook.tree,
    taskTagsHook,
    classifications: { schemes, options: classificationOptions, classifications },
    lensKey,
    statusFilter,
    hideCompleted,
    membershipTitles: membership.titlesByIdea,
    selectedId,
    focusRootId,
  });

  const handleSetClassification = async (id: string, value: string | null) => {
    if (lensKey === "area") return;
    const prev = valueOf(id);
    await setClassification(id, lensKey, value);
    registerUndo({
      label: "Project grouping updated",
      run: async () => {
        await setClassification(id, lensKey, prev);
      },
    });
  };

  const handleSetPriority = async (id: string, value: string | null) => {
    const prev = priorityOf(id);
    await setClassification(id, "priority", value);
    registerUndo({
      label: "Priority updated",
      run: async () => {
        await setClassification(id, "priority", prev);
      },
    });
  };

  const handleReplaceAreaTag = async (projectId: string, tag: Tag) => {
    const current = taskTagsHook.getTagsForIdea(projectId)[0] ?? null;
    if (current?.id === tag.id) {
      return;
    }
    if (current) await taskTagsHook.removeTagFromTask(projectId, current.id);
    await taskTagsHook.addTagToTask(projectId, tag);
    registerUndo({
      label: "Project area updated",
      run: async () => {
        await taskTagsHook.removeTagFromTask(projectId, tag.id);
        if (current) await taskTagsHook.addTagToTask(projectId, current);
      },
    });
  };

  const handleAddProjectInGroup = async (groupValue: string | null) => {
    const id = await actions.addProject();
    if (id) {
      if (groupValue && lensKey !== "area") {
        await setClassification(id, lensKey, groupValue);
      }
      handleSelect(id);
      setSelectedTreeId(id);
      setEditingId(id);
    }
  };

  const tasksGroupBy = useUiPrefsStore((s) => s.projectTasksGroupBy);

  /** Single UI entry for "new editable row": expand parent, select + edit the draft. */
  const spawnEditable = (id: string, parentId: string | null) => {
    if (parentId) ideasHook.expandIdea(parentId);
    setSelectedTreeId(id);
    setEditingId(id);
  };

  /** Inline composer submit: create with text directly under focus (or project root). */
  const handleComposerAdd = async (text: string) => {
    const parentId = focusedId ?? selectedId;
    if (!parentId) return;
    const id = await actions.createIdea(text, parentId, "bottom", {
      type: "task",
      status: "draft",
    });
    if (id) {
      ideasHook.expandIdea(parentId);
      setSelectedTreeId(id);
    }
  };

  /** Paths-mode composer: create with text under the project, then place on the selected path. */
  const handleComposerAddToPath = async (text: string) => {
    if (!selectedId) return;
    const id = await actions.createIdea(text, selectedId, "bottom", {
      type: "task",
      status: "draft",
    });
    if (id) {
      ideasHook.expandIdea(selectedId);
      if (canvasApi?.selectedPathId) await canvasApi.addToPath(id);
      setSelectedTreeId(id);
    }
  };

  const handleAddProject = async () => {
    const id = await actions.addProject();
    if (id) {
      handleSelect(id);
      spawnEditable(id, null);
    }
  };

  /** Grouped TASKS: quick-add a task under the focus root, pre-tagged with the group value. */
  const handleAddTaskInGroup = async (groupValue: string | null) => {
    const parentId = focusedId ?? selectedId;
    if (!parentId || !detailLens) return;
    const id = await actions.createIdea("", parentId, "bottom", {
      type: "task",
      status: "draft",
    });
    if (!id) return;
    if (groupValue) await setClassification(id, detailLens.scheme.key, groupValue);
    ideasHook.expandIdea(parentId);
    spawnEditable(id, parentId);
  };

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const commitCardRename = async (id: string) => {
    await actions.commitRename(id, renameDraft);
    setRenamingCardId(null);
  };

  const startCardRename = (p: Idea) => {
    setRenamingCardId(p.id);
    setRenameDraft(p.text);
  };

  const quickAddTaskToProject = async (projectId: string) => {
    const id = await actions.addTask(projectId);
    if (id) {
      if (!expandedCards.has(projectId)) toggleCard(projectId);
      spawnEditable(id, projectId);
    }
  };

  const directChildrenOf = (projectId: string): Idea[] =>
    projectTree.childrenById.get(projectId) ?? [];

  const commitTitleRename = async () => {
    if (!selectedId) return;
    await actions.commitRename(selectedId, titleDraft);
    setTitleEditing(false);
  };

  if (ideasHook.loading) {
    return (
      <AppShell title="Projects">
        <div className="flex justify-center py-20">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </AppShell>
    );
  }

  // Detail view — focused project tree
  if (selectedId && selectedProject) {
    const composerParent = focusedId
      ? (ideasHook.ideas.find((i) => i.id === focusedId) ?? null)
      : null;
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
      hideClosed: detailHideClosed,
      hideCompleted: detailHideCompleted,
      hideDeferred: false,
      pathChipsForIdea: (id: string) => membership.titlesByIdea.get(id) ?? [],
      onFocus: (id: string | null) => setFocusedId(id === selectedId ? null : id),
      cardMode: false,
      compact: effectiveMode === "split",
      onAddToPath: effectiveMode === "split" ? handleAddToPath : undefined,
      isInPath,
      pathAddDisabled: !canvasApi?.selectedPathId,
    };
    const groupSchemeOptions = [...schemes]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ key: s.key, label: s.label }));
    const detailStat = statOf(selectedProject.id);
    const detailNext = detailStat.nextId
      ? (ideasHook.ideas.find((i) => i.id === detailStat.nextId) ?? null)
      : null;
    const detailFocusedIdea = focusedId
      ? (ideasHook.ideas.find((i) => i.id === focusedId) ?? selectedProject)
      : selectedProject;
    return (
      <AppShell
        title={selectedProject.text || "Untitled project"}
        fullWidth
        headerStartActions={
          <ProjectDetailStartActions
            detailHideClosed={detailHideClosed}
            detailHideCompleted={detailHideCompleted}
            effectiveMode={effectiveMode}
            unpathedCount={unpathedCount}
            unpathedOnly={unpathedOnly}
            onBack={() => handleSelect(null)}
            onToggleHideClosed={() => setPrefs({ projectsDetailHideClosed: !detailHideClosed })}
            onToggleHideCompleted={() =>
              setPrefs({ projectsDetailHideCompleted: !detailHideCompleted })
            }
            onToggleUnpathedOnly={() => setUnpathedOnly((v) => !v)}
          />
        }
        headerActions={
          <ProjectDetailActions
            project={selectedProject}
            effectiveMode={effectiveMode}
            isNarrow={isNarrow}
            onViewModeChange={setViewMode}
            onOpenDetails={() => openNotes(selectedId)}
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
          onSelectBreadcrumb={(id) => setFocusedId(id === selectedId ? null : id)}
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
              onGroupByChange={(v) => setPrefs({ projectTasksGroupBy: v })}
              groupColumns={detailLens?.columns ?? null}
              groupValueOf={detailLens ? detailLens.valueOf : null}
              groupedForest={groupedForest}
              hideIds={unpathedOnly ? pathedIds : undefined}
              focusId={focusedId ?? selectedId}
              onAddTaskInGroup={(value) => void handleAddTaskInGroup(value)}
            />
          }
          paths={{
            projectId: selectedProject.id,
            tasks: projectTasks,
            links: linksHook.links,
            tagsForTask: taskTagsHook.getTagsForIdea,
            onUpdateTask: updateIdea,
            onOpenNotes: openNotes,
            onCreateLink: (s, t, type) => createLink(s, t, type),
            onDeleteLink: deleteLink,
            fillHeight: effectiveMode === "split",
            fitTick,
            onCanvasApi: handleCanvasApi,
            hideClosed: detailHideClosed,
          }}
          suggestIdeas={ideasHook.ideas}
          onComposerAddToPath={(text) => void handleComposerAddToPath(text)}
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

  // List view — lens-board of projects (subset type=project)

  const renderProjectCard = (p: Idea) => {
    const { done, total } = statOf(p.id);
    return (
      <ProjectCard
        key={p.id}
        project={p}
        done={done}
        total={total}
        area={taskTagsHook.getTagsForIdea(p.id)[0]?.area ?? null}
        areaTags={taskTagsHook.getTagsForIdea(p.id)}
        allTags={tagsHook.tags}
        priority={priorityOf(p.id)}
        lensKey={lensKey}
        lensLabel={lensTabs.find((t) => t.key === lensKey)?.label ?? "Group"}
        groupValue={valueOf(p.id)}
        groupOptions={columns}
        groupHint={hintForValue(lensKey, valueOf(p.id))}
        renaming={renamingCardId === p.id}
        renameDraft={renameDraft}
        expanded={expandedCards.has(p.id)}
        hideCompleted={hideCompleted}
        tasks={directChildrenOf(p.id)}
        allIdeas={ideasHook.ideas}
        links={linksHook.links}
        hasChildren={directChildrenOf(p.id).length > 0}
        getTagsForIdea={taskTagsHook.getTagsForIdea}
        onSelect={handleSelect}
        onStartRename={startCardRename}
        onRenameDraftChange={setRenameDraft}
        onCommitRename={(id) => void commitCardRename(id)}
        onCancelRename={() => setRenamingCardId(null)}
        onSetPriority={(id, v) => void handleSetPriority(id, v)}
        onSetClassification={(id, v) => void handleSetClassification(id, v)}
        onReplaceAreaTag={(projectId, tag) => void handleReplaceAreaTag(projectId, tag)}
        onRemoveAreaTag={(projectId, tagId) =>
          void taskTagsHook.removeTagFromTask(projectId, tagId)
        }
        onCreateTag={tagsHook.createTag}
        onToggleExpand={toggleCard}
        onQuickAddTask={(id) => void quickAddTaskToProject(id)}
        onUpdateStatus={(id, status) => void updateIdea(id, { status })}
        onToggleTask={(id, completed) => void (completed ? markDone(id) : markUndone(id))}
        onDelete={deleteIdea}
        onSchedule={scheduleIdea}
        onCreateLink={createLink}
        onDeleteLink={deleteLink}
        onMove={moveIdea}
        onCreateParent={createParentAndMove}
        onMoved={(id) => {
          if (id) ideasHook.expandIdea(id);
        }}
        onOpenNotes={openNotes}
      />
    );
  };

  return (
    <ProjectListView
      columns={columns}
      groupedProjects={groupedProjects}
      visibleCount={visibleProjects.length}
      lensKey={lensKey}
      lensTabs={lensTabs}
      statusFilter={statusFilter}
      hideCompleted={hideCompleted}
      unclassifiedExpanded={unclassifiedExpanded}
      undoAction={undoAction}
      renderCard={renderProjectCard}
      onLensChange={handleLensChange}
      onStatusFilterChange={setStatusFilter}
      onToggleHideCompleted={() => setHideCompleted((v) => !v)}
      onToggleUnclassifiedExpanded={(expanded) =>
        setPrefs({ projectsUnclassifiedExpanded: expanded })
      }
      onAddProject={() => void handleAddProject()}
      onAddProjectInGroup={(value) => void handleAddProjectInGroup(value)}
      onUndo={handleUndo}
      onDismissUndo={clearUndo}
    />
  );
}

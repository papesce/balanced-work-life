"use client";

import { useEffect, useState } from "react";
import { useClassifications } from "@/hooks/useClassifications";
import { useIdeas } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { usePathMembership } from "@/hooks/usePathMembership";
import { useProjectActions, withUndo } from "@/hooks/useProjectActions";
import { useProjectsDerived } from "@/hooks/useProjectsDerived";
import { useProjectsSelection } from "@/hooks/useProjectsSelection";
import { useProjectsSplit } from "@/hooks/useProjectsSplit";
import { useTaskTags } from "@/hooks/useTaskTags";
import { useTags } from "@/hooks/useTags";
import { useNotes } from "@/contexts/NotesContext";
import { useProjectTreeStore } from "@/stores/projectTreeStore";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import { nextDetailFocus } from "@/lib/detailFocus";
import type { Idea, Tag } from "@/lib/types";

type ProjectActions = ReturnType<typeof useProjectActions>;
type IdeasApi = ReturnType<typeof useIdeas>;
type LinksApi = ReturnType<typeof useIdeaLinks>;
type TagsApi = ReturnType<typeof useTags>;
type TaskTagsApi = ReturnType<typeof useTaskTags>;
type Membership = ReturnType<typeof usePathMembership>;
type SplitApi = ReturnType<typeof useProjectsSplit>;
type Derived = ReturnType<typeof useProjectsDerived>;
type Selection = ReturnType<typeof useProjectsSelection>;

export interface ProjectsPageModel extends SplitApi, Omit<Derived, "selectedProject">, Selection {
  selectedProject: NonNullable<Derived["selectedProject"]>;
  valuesBySchemeKey: Derived["valuesBySchemeKey"];
  projects: Derived["projects"];
  focusForest: Derived["focusForest"];
  selectedId: string | null;
  onFocusNode: (id: string | null) => void;
  ideasHook: IdeasApi;
  linksHook: LinksApi;
  tagsHook: TagsApi;
  taskTagsHook: TaskTagsApi;
  membership: Membership;
  openNotes: (id: string) => void;
  schemes: ReturnType<typeof useClassifications>["schemes"];
  actions: ProjectActions;
  statOf: (id: string) => { done: number; total: number; direct: number; nextId: string | null };
  childrenOf: (id: string) => Idea[];
  lensKey: string;
  unclassifiedExpanded: boolean;
  detailHideCompleted: boolean;
  detailHideClosed: boolean;
  tasksGroupBy: string | null;
  hideCompleted: boolean;
  hideChildProjects: boolean;
  statusFilter: "all" | "open";
  setPrefs: ReturnType<typeof useUiPrefsStore.getState>["set"];
  setHideCompleted: (value: boolean) => void;
  setStatusFilter: (value: "all" | "open") => void;
  onToggleHideCompleted: () => void;
  onToggleHideChildProjects: () => void;
  onToggleUnclassifiedExpanded: (expanded: boolean) => void;
  onToggleDetailHideCompleted: () => void;
  onToggleDetailHideClosed: () => void;
  onToggleUnpathedOnly: () => void;
  onGroupByChange: (value: string | null) => void;
  expandedCards: Set<string>;
  renamingCardId: string | null;
  renameDraft: string;
  setRenamingCardId: (id: string | null) => void;
  setRenameDraft: (value: string) => void;
  toggleCard: (id: string) => void;
  startCardRename: (idea: Idea) => void;
  commitCardRename: (id: string) => Promise<void>;
  quickAddTaskToProject: (projectId: string) => Promise<void>;
  showType: boolean;
  showArea: boolean;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  selectedTreeId: string | null;
  setSelectedTreeId: (id: string | null) => void;
  composing: {
    nodeId: string;
    parentId: string | null;
    position: "child" | "top" | "bottom";
    depth: number;
  } | null;
  setComposing: (value: ProjectsPageModel["composing"]) => void;
  titleEditing: boolean;
  titleDraft: string;
  setTitleEditing: (value: boolean) => void;
  setTitleDraft: (value: string) => void;
  commitTitleRename: () => Promise<void>;
  handleSetClassification: (id: string, value: string | null) => Promise<void>;
  handleSetPriority: (id: string, value: string | null) => Promise<void>;
  handleReplaceAreaTag: (projectId: string, tag: Tag) => Promise<void>;
  handleAddProject: () => Promise<void>;
  handleAddProjectInGroup: (value: string | null) => Promise<void>;
  handleComposerAdd: (text: string) => Promise<void>;
  handleComposerAddToPath: (text: string) => Promise<void>;
  handleAddTaskInGroup: (value: string | null) => Promise<void>;
  spawnEditable: (id: string, parentId: string | null) => void;
  undoAction: ProjectActions["undoAction"];
  handleUndo: () => Promise<void>;
  clearUndo: () => void;
  completionEffects: ProjectActions["completionEffects"];
  setCompletionEffects: ProjectActions["setCompletionEffects"];
}

/**
 * All projects-page state and mutation logic in one hook. The page (and the
 * detail/list views that wrap it) just read and call off this model.
 */
export function useProjectsPage(): ProjectsPageModel {
  const [hideCompleted, setHideCompleted] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "open">("open");
  const lensKey = useUiPrefsStore((s) => s.projectsLens);
  const unclassifiedExpanded = useUiPrefsStore((s) => s.projectsUnclassifiedExpanded);
  const detailHideCompleted = useUiPrefsStore((s) => s.projectsDetailHideCompleted);
  const detailHideClosed = useUiPrefsStore((s) => s.projectsDetailHideClosed);
  const hideChildProjects = useUiPrefsStore((s) => s.projectsHideChildProjects);
  const tasksGroupBy = useUiPrefsStore((s) => s.projectTasksGroupBy);
  const setPrefs = useUiPrefsStore((s) => s.set);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [renamingCardId, setRenamingCardId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
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

  const ideasHook = useIdeas({ scope: "all" });
  const linksHook = useIdeaLinks();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();

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

  const {
    columns,
    projects,
    valueOf,
    valuesBySchemeKey,
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
    focusForest,
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

  const actions = useProjectActions({
    ideasHook,
    linksHook,
    onDeleteIds: (deletedIds) => {
      if (selectedId && deletedIds.has(selectedId)) handleSelect(null);
    },
  });

  // Shared O(N) tree: computed once per ideas change in the store,
  // not per page render. Feed PowerSync rows in; rows subscribe out.
  const setTreeIdeas = useProjectTreeStore((s) => s.setIdeas);
  const statOf = useProjectTreeStore((s) => s.statOf);
  const childrenOf = useProjectTreeStore((s) => s.childrenOf);
  useEffect(() => {
    setTreeIdeas(ideasHook.ideas);
  }, [ideasHook.ideas, setTreeIdeas]);

  const {
    undoAction,
    clearUndo,
    handleUndo,
    completionEffects,
    setCompletionEffects,
    createIdea,
    commitRename,
    addTask,
    addProject,
    registerUndo,
  } = actions;

  const handleSetClassification = async (id: string, value: string | null) => {
    if (lensKey === "area") return;
    const prev = valueOf(id);
    await setClassification(id, lensKey, value);
    withUndo(registerUndo, "Project grouping updated", async () => {
      await setClassification(id, lensKey, prev);
    });
  };

  const handleSetPriority = async (id: string, value: string | null) => {
    const prev = priorityOf(id);
    await setClassification(id, "priority", value);
    withUndo(registerUndo, "Priority updated", async () => {
      await setClassification(id, "priority", prev);
    });
  };

  const handleReplaceAreaTag = async (projectId: string, tag: Tag) => {
    const current = taskTagsHook.getTagsForIdea(projectId)[0] ?? null;
    if (current?.id === tag.id) {
      return;
    }
    if (current) await taskTagsHook.removeTagFromTask(projectId, current.id);
    await taskTagsHook.addTagToTask(projectId, tag);
    const oldTag = current;
    registerUndo({
      label: "Project area updated",
      run: async () => {
        await taskTagsHook.removeTagFromTask(projectId, tag.id);
        if (oldTag) await taskTagsHook.addTagToTask(projectId, oldTag);
      },
    });
  };

  const handleAddProjectInGroup = async (groupValue: string | null) => {
    const id = await addProject();
    if (id) {
      if (groupValue && lensKey !== "area") {
        await setClassification(id, lensKey, groupValue);
      }
      handleSelect(id);
      setSelectedTreeId(id);
      setEditingId(id);
    }
  };

  // Single UI entry for "new editable row": expand parent, select + edit the draft.
  const spawnEditable = (id: string, parentId: string | null) => {
    if (parentId) ideasHook.expandIdea(parentId);
    setSelectedTreeId(id);
    setEditingId(id);
  };

  // Inline composer submit: create with text directly under focus (or project root).
  const handleComposerAdd = async (text: string) => {
    const parentId = focusedId ?? selectedId;
    if (!parentId) return;
    const id = await createIdea(text, parentId, "bottom", {
      type: "task",
      status: "draft",
    });
    if (id) {
      ideasHook.expandIdea(parentId);
      setSelectedTreeId(id);
    }
  };

  // Paths-mode composer: create with text under the project, then place on the selected path.
  const handleComposerAddToPath = async (text: string) => {
    if (!selectedId) return;
    const id = await createIdea(text, selectedId, "bottom", {
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
    const id = await addProject();
    if (id) {
      handleSelect(id);
      spawnEditable(id, null);
    }
  };

  // Grouped TASKS: quick-add a task under the focus root, pre-tagged with the group value.
  const handleAddTaskInGroup = async (groupValue: string | null) => {
    const parentId = focusedId ?? selectedId;
    if (!parentId || !detailLens) return;
    const id = await createIdea("", parentId, "bottom", {
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
    await commitRename(id, renameDraft);
    setRenamingCardId(null);
  };

  const startCardRename = (p: Idea) => {
    setRenamingCardId(p.id);
    setRenameDraft(p.text);
  };

  const quickAddTaskToProject = async (projectId: string) => {
    const id = await addTask(projectId);
    if (id) {
      if (!expandedCards.has(projectId)) toggleCard(projectId);
      spawnEditable(id, projectId);
    }
  };

  const commitTitleRename = async () => {
    if (!selectedId) return;
    await commitRename(selectedId, titleDraft);
    setTitleEditing(false);
  };

  /** Focus one node; selecting the project root returns to the root. */
  const onFocusNode = (id: string | null) => setFocusedId(nextDetailFocus(selectedId, id));

  return {
    // selection
    selectedId,
    focusedId,
    setFocusedId,
    unpathedOnly,
    setUnpathedOnly,
    handleSelect,
    breadcrumbChain,
    focusRootId,
    onFocusNode,
    // split/layout
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
    // data
    ideasHook,
    linksHook,
    tagsHook,
    taskTagsHook,
    membership,
    openNotes,
    schemes,
    actions,
    statOf,
    childrenOf,
    // derived (list + detail)
    columns,
    valueOf,
    priorityOf,
    visibleProjects,
    groupedProjects,
    handleLensChange,
    lensTabs,
    selectedProject: selectedProject!,
    valuesBySchemeKey,
    projects,
    focusForest,
    projectTasks,
    pathedIds,
    unpathedCount,
    detailLens,
    groupedForest,
    // prefs
    lensKey,
    unclassifiedExpanded,
    detailHideCompleted,
    detailHideClosed,
    tasksGroupBy,
    hideCompleted,
    hideChildProjects,
    statusFilter,
    setPrefs,
    setHideCompleted,
    setStatusFilter,
    onToggleHideCompleted: () => setHideCompleted((v) => !v),
    onToggleHideChildProjects: () => setPrefs({ projectsHideChildProjects: !hideChildProjects }),
    onToggleUnclassifiedExpanded: (expanded: boolean) => {
      setPrefs({ projectsUnclassifiedExpanded: expanded });
    },
    onToggleDetailHideCompleted: () =>
      setPrefs({ projectsDetailHideCompleted: !detailHideCompleted }),
    onToggleDetailHideClosed: () => setPrefs({ projectsDetailHideClosed: !detailHideClosed }),
    onToggleUnpathedOnly: () => setUnpathedOnly((v) => !v),
    onGroupByChange: (v: string | null) => setPrefs({ projectTasksGroupBy: v }),
    // card editing (list view)
    expandedCards,
    renamingCardId,
    renameDraft,
    setRenamingCardId,
    setRenameDraft,
    toggleCard,
    startCardRename,
    commitCardRename,
    quickAddTaskToProject,
    showType,
    showArea,
    editingId,
    setEditingId,
    selectedTreeId,
    setSelectedTreeId,
    composing,
    setComposing,
    // detail title
    titleEditing,
    titleDraft,
    setTitleEditing,
    setTitleDraft,
    commitTitleRename,
    // handlers (mutations)
    handleSetClassification,
    handleSetPriority,
    handleReplaceAreaTag,
    handleAddProject,
    handleAddProjectInGroup,
    handleComposerAdd,
    handleComposerAddToPath,
    handleAddTaskInGroup,
    spawnEditable,
    // undo
    undoAction,
    handleUndo,
    clearUndo,
    completionEffects,
    setCompletionEffects,
  };
}

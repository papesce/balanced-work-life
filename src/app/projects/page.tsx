"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  FileText,
  Pencil,
  Check,
  X,
  ListTree,
} from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useClassifications } from "@/hooks/useClassifications";
import { TERMINAL_STATUSES } from "@/lib/constants";
import { priorityRank, type PriorityValue } from "@/components/shared/PriorityChip";
import { groupKeyOf, optionsForScheme } from "@/components/lens";
import { buildLensColumns, resolveLens } from "@/lib/horizonLenses";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import { AppShell } from "@/components/AppShell";
import { IdeaTree } from "@/components/brainstorm/IdeaTree";
import { BrainstormBreadcrumb } from "@/components/brainstorm/BrainstormBreadcrumb";
import { useNotes } from "@/contexts/NotesContext";
import { useIdeas } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { useProjectActions } from "@/hooks/useProjectActions";
import { useProjectLookups } from "@/stores/projectLookups";
import { useProjectTreeStore } from "@/stores/projectTreeStore";
import { Idea, Tag, type IdeaNode } from "@/lib/types";
import { getAncestorChain } from "@/lib/ideaTreeFocus";
import { hasAnyEffects } from "@/lib/linkEffects";
import { LinkedEffectsReveal } from "@/components/shared/LinkedEffectsReveal";
import { UndoBar } from "@/components/shared/UndoBar";
import { hintForValue } from "@/lib/classificationHelp";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectListView } from "@/components/projects/ProjectListView";
import { ProjectPathsTab, type PathCanvasApi } from "@/components/projects/ProjectPathsTab";
import { ProjectFiltersMenu } from "@/components/projects/ProjectFiltersMenu";
import { TaskComposer } from "@/components/shared/TaskComposer";
import { usePathMembership } from "@/hooks/usePathMembership";
import { clampSplitRatio, resolveEffectiveMode, SPLIT_MIN_WIDTH } from "@/lib/projectSplit";
import type { ProjectViewMode } from "@/stores/uiPrefsStore";

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialProjectId = searchParams.get("projectId");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "open">("open");
  const [selectedId, setSelectedId] = useState<string | null>(initialProjectId);
  const lensKey = useUiPrefsStore((s) => s.projectsLens);
  const unclassifiedExpanded = useUiPrefsStore((s) => s.projectsUnclassifiedExpanded);
  const setPrefs = useUiPrefsStore((s) => s.set);
  // Detail focus is local-only (subtree re-root); selectedId stays the project in URL.
  const [focusedId, setFocusedId] = useState<string | null>(null);
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
  // Split-view layout: persisted mode + ratio; narrow screens force one pane.
  const projectViewMode = useUiPrefsStore((s) => s.projectViewMode);
  const projectSplitRatio = useUiPrefsStore((s) => s.projectSplitRatio);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : SPLIT_MIN_WIDTH,
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isNarrow = viewportWidth < SPLIT_MIN_WIDTH;
  const effectiveMode = resolveEffectiveMode(projectViewMode, viewportWidth);
  const [unpathedOnly, setUnpathedOnly] = useState(false);
  // Canvas entry point reported by ProjectPathsTab (selected path + add).
  const [canvasApi, setCanvasApi] = useState<PathCanvasApi | null>(null);
  const handleCanvasApi = useCallback((api: PathCanvasApi | null) => setCanvasApi(api), []);
  const handleAddToPath = useCallback(
    (id: string) => {
      void canvasApi?.addToPath(id);
    },
    [canvasApi],
  );
  const isInPath = useCallback((id: string) => canvasApi?.placedIds.has(id) ?? false, [canvasApi]);
  // Bumped after divider drags / collapses so the canvas re-fits its viewport.
  const [fitTick, setFitTick] = useState(0);
  const fitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpFit = useCallback(() => {
    if (fitTimer.current) clearTimeout(fitTimer.current);
    fitTimer.current = setTimeout(() => setFitTick((t) => t + 1), 200);
  }, []);
  useEffect(
    () => () => {
      if (fitTimer.current) clearTimeout(fitTimer.current);
    },
    [],
  );
  const ratioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (ratioTimer.current) clearTimeout(ratioTimer.current);
    },
    [],
  );
  const handleListResize = useCallback(
    (size: { asPercentage: number }) => {
      const next = clampSplitRatio(Math.round(size.asPercentage));
      if (ratioTimer.current) clearTimeout(ratioTimer.current);
      ratioTimer.current = setTimeout(() => setPrefs({ projectSplitRatio: next }), 400);
      bumpFit();
    },
    [bumpFit, setPrefs],
  );
  const setViewMode = useCallback(
    (mode: ProjectViewMode) => {
      setPrefs({ projectViewMode: mode });
      bumpFit();
    },
    [bumpFit, setPrefs],
  );

  const ideasHook = useIdeas({ scope: "all" });
  const linksHook = useIdeaLinks();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
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

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    // Project navigation resets local focus + detail filters.
    setFocusedId(null);
    setTitleEditing(false);
    setUnpathedOnly(false);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("projectId", id);
    else params.delete("projectId");
    const qs = params.toString();
    router.replace(qs ? `/projects?${qs}` : "/projects", { scroll: false });
    if (id) ideasHook.expandIdea(id);
  };

  useEffect(() => {
    const pid = searchParams.get("projectId");
    if (pid !== selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync URL to state
      setSelectedId(pid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle highlight deep-link: auto-select containing project and pulse highlight
  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    if (!highlightId || ideasHook.loading) return;
    const idea = ideasHook.ideas.find((i) => i.id === highlightId);
    if (!idea) return;
    // Guarantee the highlight target stays visible in the project list.
    if ((TERMINAL_STATUSES as readonly string[]).includes(idea.status)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- highlight deep-link syncs selection + lifts hiding filters
      setHideCompleted(false);
      setStatusFilter("all");
    }
    const byId = new Map(ideasHook.ideas.map((i) => [i.id, i]));
    let projectId: string | null = null;
    if (idea.type === "project") projectId = idea.id;
    else {
      let cur: Idea | undefined = idea;
      while (cur?.parent_id) {
        const parent = byId.get(cur.parent_id);
        if (!parent) break;
        if (parent.type === "project") {
          projectId = parent.id;
          break;
        }
        cur = parent;
      }
    }
    if (projectId) {
      if (projectId !== selectedId) {
        setSelectedId(projectId);
        ideasHook.expandIdea(projectId);
      }
      ideasHook.expandIdea(highlightId);
      // Expand all ancestors so highlighted node is visible
      const chain = getAncestorChain(highlightId, ideasHook.ideas);
      for (const anc of chain) ideasHook.expandIdea(anc.id);
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`idea-${highlightId}`);
        if (el) {
          el.classList.add("highlight-pulse");
          setTimeout(() => el.classList.remove("highlight-pulse"), 1600);
        }
      });
    });
    const params = new URLSearchParams(searchParams.toString());
    params.delete("highlight");
    if (projectId) params.set("projectId", projectId);
    const qs = params.toString();
    router.replace(qs ? `/projects?${qs}` : "/projects", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, ideasHook.loading]);

  useEffect(() => {
    if (selectedId && !ideasHook.loading && !ideasHook.ideas.some((i) => i.id === selectedId)) {
      handleSelect(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideasHook.ideas, ideasHook.loading]);

  // Ensure the selected project is expanded so its tasks render even when it
  // sits nested (default collapse depth would otherwise hide its children).
  useEffect(() => {
    if (selectedId && !ideasHook.loading) {
      ideasHook.expandIdea(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ideasHook.loading]);

  const projects = useMemo(
    () => ideasHook.ideas.filter((i) => i.type === "project"),
    [ideasHook.ideas],
  );

  const { columns, valueOf, valuesBySchemeKey } = useProjectLookups(
    taskTagsHook,
    { schemes, options: classificationOptions, classifications },
    lensKey,
  );

  const priorityOf = useCallback(
    (ideaId: string): PriorityValue =>
      (valuesBySchemeKey.get("priority")?.get(ideaId) ?? null) as PriorityValue,
    [valuesBySchemeKey],
  );

  const visibleProjects = useMemo(() => {
    let list = projects;
    if (statusFilter === "open") {
      list = list.filter((p) => !(TERMINAL_STATUSES as readonly string[]).includes(p.status));
    }
    if (hideCompleted) {
      list = list.filter((p) => p.status !== "completed");
    }
    return [...list].sort((a, b) => {
      const rankDiff = priorityRank(priorityOf(a.id)) - priorityRank(priorityOf(b.id));
      if (rankDiff !== 0) return rankDiff;
      return b.updated_at.localeCompare(a.updated_at);
    });
  }, [projects, statusFilter, hideCompleted, priorityOf]);

  const groupedProjects = useMemo(() => {
    const grouped = new Map<string | null, Idea[]>();
    for (const p of visibleProjects) {
      const key = valueOf(p.id);
      const list = grouped.get(key) ?? [];
      list.push(p);
      grouped.set(key, list);
    }
    return grouped;
  }, [visibleProjects, valueOf]);

  const handleLensChange = (key: string) => {
    if (key === lensKey) return;
    setPrefs({ projectsLens: key });
  };

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

  const lensTabs = useMemo(() => {
    const tabs: { key: string; label: string }[] = schemes
      .filter((s) => ["term", "nnl", "moscow", "priority", "attention"].includes(s.key))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ key: s.key, label: s.key === "term" ? "Horizon" : s.label }));
    return [...tabs, { key: "area", label: "Area" }];
  }, [schemes]);

  const selectedProject = useMemo(
    () => (selectedId ? (ideasHook.ideas.find((i) => i.id === selectedId) ?? null) : null),
    [ideasHook.ideas, selectedId],
  );

  const projectTasks = useMemo(() => {
    if (!selectedProject) return [];
    const children = new Map<string, Idea[]>();
    for (const idea of ideasHook.ideas) {
      if (!idea.parent_id) continue;
      const group = children.get(idea.parent_id) ?? [];
      group.push(idea);
      children.set(idea.parent_id, group);
    }
    const result: Idea[] = [];
    const stack = [...(children.get(selectedProject.id) ?? [])];
    while (stack.length) {
      const task = stack.pop()!;
      result.push(task);
      stack.push(...(children.get(task.id) ?? []));
    }
    return result;
  }, [ideasHook.ideas, selectedProject]);

  const breadcrumbChain = useMemo(
    () => (selectedId ? getAncestorChain(selectedId, ideasHook.ideas) : []),
    [selectedId, ideasHook.ideas],
  );

  const pathedIds = useMemo(
    () => new Set(membership.titlesByIdea.keys()),
    [membership.titlesByIdea],
  );
  const unpathedCount = useMemo(
    () => projectTasks.filter((t) => !pathedIds.has(t.id)).length,
    [projectTasks, pathedIds],
  );

  // Detail TASKS grouping (Option A): bucket the focus-root's direct-child
  // subtrees by a user-picked classification scheme. Subtrees travel intact
  // with their top-level parent — no Horizon-style promotion.
  const tasksGroupBy = useUiPrefsStore((s) => s.projectTasksGroupBy);
  const detailLens = useMemo(() => {
    if (!tasksGroupBy) return null;
    const infos = schemes.map((s) => ({
      key: s.key,
      label: s.label,
      options: optionsForScheme(classificationOptions, s.id).map((o) => o.value),
    }));
    const { lens } = resolveLens(tasksGroupBy, infos);
    const scheme =
      schemes.find((s) => s.key === lens.primaryScheme) ??
      schemes.find((s) => s.key === tasksGroupBy) ??
      null;
    if (!scheme) return null;
    const columns = buildLensColumns(lens, optionsForScheme(classificationOptions, scheme.id));
    const inner = valuesBySchemeKey.get(scheme.key);
    return { scheme, columns, valueOf: (id: string) => inner?.get(id) ?? null };
  }, [tasksGroupBy, schemes, classificationOptions, valuesBySchemeKey]);

  const focusRootId = focusedId ?? selectedId;
  const focusForest: IdeaNode[] = useMemo(() => {
    if (!focusRootId) return [];
    const findNode = (nodes: IdeaNode[]): IdeaNode | null => {
      for (const n of nodes) {
        if (n.id === focusRootId) return n;
        const found = findNode(n.children);
        if (found) return found;
      }
      return null;
    };
    return findNode(ideasHook.tree)?.children ?? [];
  }, [ideasHook.tree, focusRootId]);

  const groupedForest = useMemo(() => {
    if (!detailLens) return null;
    const grouped = new Map<string, IdeaNode[]>();
    for (const node of focusForest) {
      const key = groupKeyOf(detailLens.valueOf(node.id));
      const list = grouped.get(key) ?? [];
      list.push(node);
      grouped.set(key, list);
    }
    return grouped;
  }, [detailLens, focusForest]);

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
    const listPane = (
      <div className="flex min-h-0 flex-col">
        <div className="sticky top-0 z-10 bg-white pb-2 dark:bg-gray-950">
          <TaskComposer
            variant="tree"
            placeholder={
              composerParent
                ? `+ Add subtask to ${composerParent.text || "untitled"}…`
                : "+ Add task…"
            }
            onCreate={handleComposerAdd}
            suggestFrom={ideasHook.ideas}
            currentView="projects"
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <label
              htmlFor="tasks-group-by"
              className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500"
            >
              Group
            </label>
            <select
              id="tasks-group-by"
              value={tasksGroupBy ?? ""}
              onChange={(e) => setPrefs({ projectTasksGroupBy: e.target.value || null })}
              aria-label="Group tasks by classification"
              className="rounded-lg border border-gray-200 bg-gray-100 px-1.5 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
            >
              <option value="">Manual</option>
              {groupSchemeOptions.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!detailLens || !groupedForest ? (
          <IdeaTree
            tree={ideasHook.tree}
            {...sharedTreeProps}
            hideIds={unpathedOnly ? pathedIds : undefined}
            focusedId={focusedId ?? selectedId}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {detailLens.columns.map((col) => {
              const forest = groupedForest.get(groupKeyOf(col.key)) ?? [];
              if (forest.length === 0) return null;
              return (
                <section key={groupKeyOf(col.key)} aria-label={col.label}>
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                      {col.label}
                    </h4>
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {forest.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleAddTaskInGroup(col.key)}
                      title={`Add task to ${col.label}`}
                      aria-label={`Add task to ${col.label}`}
                      className="rounded-lg p-1 text-gray-400 hover:bg-black/5 hover:text-violet-600"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <IdeaTree
                    tree={forest}
                    {...sharedTreeProps}
                    hideIds={unpathedOnly ? pathedIds : undefined}
                    focusedId={null}
                  />
                </section>
              );
            })}
          </div>
        )}
      </div>
    );
    const pathsPane = (
      <ProjectPathsTab
        projectId={selectedProject.id}
        tasks={projectTasks}
        links={linksHook.links}
        tagsForTask={taskTagsHook.getTagsForIdea}
        onUpdateTask={updateIdea}
        onOpenNotes={openNotes}
        onCreateLink={(s, t, type) => createLink(s, t, type)}
        onDeleteLink={deleteLink}
        fillHeight={effectiveMode === "split"}
        fitTick={fitTick}
        onCanvasApi={handleCanvasApi}
        hideClosed={detailHideClosed}
      />
    );
    return (
      <AppShell
        title={selectedProject.text || "Untitled project"}
        fullWidth
        headerStartActions={
          <>
            <button
              onClick={() => handleSelect(null)}
              className="toolbar-btn flex items-center gap-1.5"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <ProjectFiltersMenu
              hideClosed={detailHideClosed}
              onToggleHideClosed={() => setPrefs({ projectsDetailHideClosed: !detailHideClosed })}
              hideCompleted={detailHideCompleted}
              onToggleHideCompleted={() =>
                setPrefs({ projectsDetailHideCompleted: !detailHideCompleted })
              }
            />
            {effectiveMode !== "paths" && unpathedCount > 0 && (
              <button
                type="button"
                onClick={() => setUnpathedOnly((v) => !v)}
                aria-pressed={unpathedOnly}
                title="Show only tasks that belong to no path"
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  unpathedOnly
                    ? "border-indigo-300 bg-white text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
                    : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
                }`}
              >
                Unpathed ({unpathedCount})
              </button>
            )}
          </>
        }
        headerActions={
          <div className="flex items-center gap-2">
            <div
              className="flex rounded-xl border border-gray-200 p-0.5 dark:border-gray-700"
              aria-label="Project view"
            >
              <button
                onClick={() => setViewMode("list")}
                aria-pressed={effectiveMode === "list"}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${effectiveMode === "list" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" : "text-gray-500"}`}
              >
                List
              </button>
              {!isNarrow && (
                <button
                  onClick={() => setViewMode("split")}
                  aria-pressed={effectiveMode === "split"}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${effectiveMode === "split" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" : "text-gray-500"}`}
                >
                  Split
                </button>
              )}
              <button
                onClick={() => setViewMode("paths")}
                aria-pressed={effectiveMode === "paths"}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${effectiveMode === "paths" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" : "text-gray-500"}`}
              >
                Paths
              </button>
            </div>
            <button
              onClick={() => openNotes(selectedId)}
              className="toolbar-btn flex items-center gap-1.5"
              title={selectedProject.notes?.trim() ? "Edit project details" : "Add project details"}
              aria-label={
                selectedProject.notes?.trim() ? "Edit project details" : "Add project details"
              }
            >
              <FileText
                size={14}
                strokeWidth={selectedProject.notes?.trim() ? 2 : 1.5}
                className={selectedProject.notes?.trim() ? "text-indigo-500" : ""}
              />
              Details
              {selectedProject.notes?.trim() ? (
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden />
              ) : null}
            </button>
          </div>
        }
      >
        {breadcrumbChain.length > 0 && (
          <div className="mb-3">
            <BrainstormBreadcrumb
              chain={breadcrumbChain}
              focused={
                focusedId
                  ? (ideasHook.ideas.find((i) => i.id === focusedId) ?? selectedProject)
                  : selectedProject
              }
              onSelect={(id) => setFocusedId(id === selectedId ? null : id)}
            />
          </div>
        )}

        {/* Editable project title — click to rename without leaving the view */}
        <div className="mb-2 flex items-center gap-2">
          {titleEditing ? (
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitTitleRename();
                  if (e.key === "Escape") setTitleEditing(false);
                }}
                onBlur={() => void commitTitleRename()}
                aria-label="Rename project"
                className="min-w-0 flex-1 rounded-lg border border-violet-300 bg-white px-2 py-1 text-lg font-bold focus:ring-2 focus:ring-violet-500/30 focus:outline-none dark:border-violet-700 dark:bg-gray-800"
              />
              <button
                onClick={() => void commitTitleRename()}
                aria-label="Save project name"
                className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
              >
                <Check size={15} />
              </button>
              <button
                onClick={() => setTitleEditing(false)}
                aria-label="Cancel rename"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5"
              >
                <X size={15} />
              </button>
            </span>
          ) : (
            <>
              <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-gray-900 dark:text-gray-100">
                {selectedProject.text || "Untitled project"}
              </h2>
              <button
                onClick={() => {
                  setTitleDraft(selectedProject.text);
                  setTitleEditing(true);
                }}
                title="Rename project"
                aria-label="Rename project"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-violet-600"
              >
                <Pencil size={14} />
              </button>
            </>
          )}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="capitalize">{selectedProject.status.replace("_", " ")}</span>
          <span>·</span>
          <span>{statOf(selectedProject.id).direct} tasks</span>
          {(() => {
            const stat = statOf(selectedProject.id);
            const next = stat.nextId
              ? (ideasHook.ideas.find((i) => i.id === stat.nextId) ?? null)
              : null;
            return (
              <>
                <span>·</span>
                <span>
                  {stat.done}/{stat.total} done
                </span>
                {next && (
                  <>
                    <span>·</span>
                    <span className="truncate font-semibold text-violet-600">
                      Next: {next.text || "Untitled"}
                    </span>
                  </>
                )}
              </>
            );
          })()}
          {focusedId && (
            <button
              onClick={() => setFocusedId(null)}
              className="toolbar-btn flex items-center gap-1"
            >
              <ListTree size={12} /> Back to project root
            </button>
          )}
        </div>

        {effectiveMode === "split" ? (
          <Group
            orientation="horizontal"
            className="flex h-[calc(100dvh-300px)] min-h-[560px] w-full"
          >
            <Panel
              id="project-list"
              defaultSize={`${clampSplitRatio(projectSplitRatio)}%`}
              minSize="25%"
              onResize={handleListResize}
              className="min-w-0"
            >
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                    Tasks
                  </h3>
                  <button
                    onClick={() => setViewMode("paths")}
                    title="Collapse list, show paths only"
                    aria-label="Collapse list, show paths only"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-violet-600"
                  >
                    <ChevronsLeft size={14} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-2">{listPane}</div>
              </div>
            </Panel>
            <Separator
              className="mx-1 w-2 shrink-0 cursor-col-resize rounded-full bg-gray-200 transition-colors hover:bg-violet-300 focus-visible:bg-violet-400 focus-visible:outline-none dark:bg-gray-700 dark:hover:bg-violet-700"
              aria-label="Resize list and paths panes"
            />
            <Panel id="project-paths" minSize="30%" className="min-w-0">
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                    Paths
                  </h3>
                  <button
                    onClick={() => setViewMode("list")}
                    title="Collapse paths, show list only"
                    aria-label="Collapse paths, show list only"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-violet-600"
                  >
                    <ChevronsRight size={14} />
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{pathsPane}</div>
              </div>
            </Panel>
          </Group>
        ) : effectiveMode === "paths" ? (
          <div className="flex min-h-0 flex-col gap-2">
            <TaskComposer
              variant="tree"
              placeholder="+ Add task to this path…"
              onCreate={handleComposerAddToPath}
              suggestFrom={ideasHook.ideas}
              currentView="projects"
            />
            {pathsPane}
          </div>
        ) : (
          listPane
        )}
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

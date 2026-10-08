"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FolderKanban,
  Plus,
  FileText,
  Pencil,
  Check,
  X,
  ListTree,
} from "lucide-react";
import { useClassifications } from "@/hooks/useClassifications";
import {
  AREA_DOT_COLORS,
  AREA_ICONS,
  AREA_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  TERMINAL_STATUSES,
} from "@/lib/constants";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";
import { PriorityChip, priorityRank, type PriorityValue } from "@/components/shared/PriorityChip";
import { TagPicker } from "@/components/shared/TagPicker";
import { areaColors } from "@/styles/tokens";
import { ColumnShell, groupKeyOf } from "@/components/lens";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import { AppShell } from "@/components/AppShell";
import { IdeaTree } from "@/components/brainstorm/IdeaTree";
import { BrainstormBreadcrumb } from "@/components/brainstorm/BrainstormBreadcrumb";
import { NotesIndicator } from "@/components/shared/NotesIndicator";
import { useNotes } from "@/contexts/NotesContext";
import { useIdeas } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { useProjectActions } from "@/hooks/useProjectActions";
import { useProjectLookups } from "@/stores/projectLookups";
import { useProjectTreeStore } from "@/stores/projectTreeStore";
import { Idea, IdeaStatus, Tag } from "@/lib/types";
import { getAncestorChain } from "@/lib/ideaTreeFocus";
import { hasAnyEffects } from "@/lib/linkEffects";
import { LinkedEffectsReveal } from "@/components/shared/LinkedEffectsReveal";
import { UndoBar } from "@/components/shared/UndoBar";
import { IdeaActionMenu } from "@/components/shared/IdeaActionMenu";
import { ValueHelpInfo } from "@/components/shared/ValueHelpInfo";
import { hintForValue } from "@/lib/classificationHelp";

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
  const [statusPickerId, setStatusPickerId] = useState<string | null>(null);
  const [areaPickerPos, setAreaPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [statusPickerPos, setStatusPickerPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [areaPickerId, setAreaPickerId] = useState<string | null>(null);
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
  const [detailHideCompleted, setDetailHideCompleted] = useState(false);

  const ideasHook = useIdeas({ scope: "all" });
  const linksHook = useIdeaLinks();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
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
      setAreaPickerId(null);
      return;
    }
    if (current) await taskTagsHook.removeTagFromTask(projectId, current.id);
    await taskTagsHook.addTagToTask(projectId, tag);
    setAreaPickerId(null);
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

  const breadcrumbChain = useMemo(
    () => (selectedId ? getAncestorChain(selectedId, ideasHook.ideas) : []),
    [selectedId, ideasHook.ideas],
  );

  /** Single UI entry for "new editable row": expand parent, select + edit the draft. */
  const spawnEditable = (id: string, parentId: string | null) => {
    if (parentId) ideasHook.expandIdea(parentId);
    setSelectedTreeId(id);
    setEditingId(id);
  };

  const handleAddTask = async () => {
    if (!selectedId) return;
    const id = await actions.addTask(selectedId);
    if (id) spawnEditable(id, selectedId);
  };

  const handleAddProject = async () => {
    const id = await actions.addProject();
    if (id) {
      handleSelect(id);
      spawnEditable(id, null);
    }
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
    return (
      <AppShell
        title={selectedProject.text || "Untitled project"}
        headerStartActions={
          <button
            onClick={() => handleSelect(null)}
            className="toolbar-btn flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> Back
          </button>
        }
        headerActions={
          <div className="flex items-center gap-2">
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
            <button
              onClick={handleAddTask}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
            >
              <Plus size={13} /> Add task
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

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={detailHideCompleted}
              onChange={(e) => setDetailHideCompleted(e.target.checked)}
              className="rounded"
            />
            Hide completed
          </label>
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
          editMode="edit"
          editingId={editingId}
          setEditingId={setEditingId}
          selectedId={selectedTreeId}
          setSelectedId={setSelectedTreeId}
          composing={composing}
          setComposing={setComposing}
          showToday={false}
          hideClosed={false}
          hideCompleted={detailHideCompleted}
          hideDeferred={false}
          focusedId={focusedId ?? selectedId}
          onFocus={(id) => setFocusedId(id === selectedId ? null : id)}
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

  // List view — lens-board of projects (subset type=project)

  const renderProjectCard = (p: Idea) => {
    const { done, total } = statOf(p.id);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const area = taskTagsHook.getTagsForIdea(p.id)[0]?.area ?? null;
    const AreaIcon = area ? AREA_ICONS[area as keyof typeof AREA_ICONS] : null;
    return (
      <div
        key={p.id}
        onClick={() => handleSelect(p.id)}
        onKeyDown={(e) => {
          if (renamingCardId === p.id) return;
          if (e.key === "Enter" || e.key === " ") handleSelect(p.id);
          else if (e.key === "e" || e.key === "F2") {
            e.preventDefault();
            startCardRename(p);
          } else if (e.key === "a") {
            e.preventDefault();
            void quickAddTaskToProject(p.id);
          }
        }}
        role="button"
        tabIndex={0}
        className={`glass-card group flex w-full cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition hover:border-violet-200 dark:hover:border-violet-800 ${
          priorityOf(p.id) === "high"
            ? "border-violet-300 shadow-[0_0_0_1px_rgba(139,92,246,0.35),0_8px_24px_rgba(139,92,246,0.12)] dark:border-violet-700"
            : "border-black/5 dark:border-white/5"
        }`}
      >
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30">
              <FolderKanban size={16} />
              {area && (
                <span
                  title={AREA_LABELS[area as keyof typeof AREA_LABELS] ?? area}
                  className={`absolute -right-1 -bottom-1 h-3 w-3 rounded-full border-2 border-white ${AREA_DOT_COLORS[area as keyof typeof AREA_DOT_COLORS] ?? "bg-gray-400"} dark:border-gray-900`}
                />
              )}
            </span>
            <div className="min-w-0">
              {renamingCardId === p.id ? (
                <span
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitCardRename(p.id);
                      if (e.key === "Escape") setRenamingCardId(null);
                    }}
                    onBlur={() => void commitCardRename(p.id)}
                    aria-label={`Rename ${p.text || "untitled project"}`}
                    className="w-full min-w-0 rounded-md border border-violet-300 px-1.5 py-0.5 text-sm font-semibold focus:ring-2 focus:ring-violet-500/30 focus:outline-none dark:border-violet-700 dark:bg-gray-800"
                  />
                  <button
                    onClick={() => void commitCardRename(p.id)}
                    aria-label="Save name"
                    className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                  >
                    <Check size={13} />
                  </button>
                </span>
              ) : (
                <p
                  className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-800 dark:text-gray-100"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startCardRename(p);
                  }}
                  title="Double-click to rename"
                >
                  <PriorityChip
                    value={priorityOf(p.id)}
                    onSelect={(v) => void handleSetPriority(p.id, v)}
                  />
                  {AreaIcon && (
                    <AreaIcon
                      size={12}
                      className="shrink-0"
                      style={{ color: area ? areaColors[area]?.dot : undefined }}
                    />
                  )}
                  {p.text || "Untitled project"}
                </p>
              )}
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
                <span className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setStatusPickerPos({ top: rect.bottom + 4, left: rect.left });
                      setStatusPickerId(statusPickerId === p.id ? null : p.id);
                    }}
                    className={`rounded-full border px-1.5 py-0 text-[10px] font-semibold whitespace-nowrap transition hover:opacity-80 ${STATUS_STYLES[p.status]}`}
                  >
                    {STATUS_LABELS[p.status] ?? p.status}
                  </button>
                  {statusPickerId === p.id && statusPickerPos && (
                    <StatusPicker
                      current={p.status}
                      onSelect={(s: IdeaStatus) => {
                        setStatusPickerId(null);
                        void updateIdea(p.id, { status: s });
                      }}
                      onClose={() => setStatusPickerId(null)}
                      position={statusPickerPos}
                    />
                  )}
                </span>
                <span>
                  {done}/{total} done
                  {p.scheduled_date ? ` · ${p.scheduled_date}` : ""}
                </span>
                {lensKey !== "area" && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <select
                      aria-label={`Change ${lensTabs.find((t) => t.key === lensKey)?.label ?? "group"} for ${p.text || "untitled project"}`}
                      title={hintForValue(lensKey, valueOf(p.id)) ?? undefined}
                      value={valueOf(p.id) ?? ""}
                      onChange={(e) => void handleSetClassification(p.id, e.target.value || null)}
                      className="max-w-[110px] cursor-pointer rounded-md border border-black/10 bg-transparent px-1 py-0 text-[10px] font-semibold text-gray-500 dark:border-white/10 dark:text-gray-400"
                    >
                      <option value="">—</option>
                      {columns
                        .filter((c) => c.key !== null)
                        .map((o) => (
                          <option key={o.key} value={o.key ?? ""}>
                            {o.label}
                          </option>
                        ))}
                    </select>
                  </span>
                )}
                {lensKey === "area" && (
                  <span className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setAreaPickerPos({ top: rect.bottom + 4, left: rect.left });
                        setAreaPickerId(areaPickerId === p.id ? null : p.id);
                      }}
                      title={hintForValue("area", area) ?? undefined}
                      className="cursor-pointer rounded-md border border-black/10 px-1 py-0 text-[10px] font-semibold text-gray-500 dark:border-white/10 dark:text-gray-400"
                    >
                      {area ? (AREA_LABELS[area as keyof typeof AREA_LABELS] ?? area) : "Set area"}
                    </button>
                    {areaPickerId === p.id && areaPickerPos && (
                      <TagPicker
                        allTags={tagsHook.tags}
                        selectedTags={taskTagsHook.getTagsForIdea(p.id)}
                        onAdd={(tag) => void handleReplaceAreaTag(p.id, tag)}
                        onRemove={(tagId) => {
                          void taskTagsHook.removeTagFromTask(p.id, tagId);
                        }}
                        onCreateTag={tagsHook.createTag}
                        onClose={() => setAreaPickerId(null)}
                        singleSelect
                        fixedPosition={areaPickerPos}
                      />
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => toggleCard(p.id)}
              title={expandedCards.has(p.id) ? "Collapse tasks" : "Expand tasks"}
              aria-label={expandedCards.has(p.id) ? "Collapse tasks" : "Expand tasks"}
              aria-expanded={expandedCards.has(p.id)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-violet-600"
            >
              <ChevronDown
                size={14}
                className={`transition-transform ${expandedCards.has(p.id) ? "rotate-180" : ""}`}
              />
            </button>
            <IdeaActionMenu
              idea={p}
              allIdeas={ideasHook.ideas}
              links={linksHook.links}
              hasChildren={directChildrenOf(p.id).length > 0}
              getTagsForIdea={taskTagsHook.getTagsForIdea}
              onEdit={() => startCardRename(p)}
              onDelete={deleteIdea}
              onSchedule={scheduleIdea}
              onCreateLink={createLink}
              onDeleteLink={deleteLink}
              onMove={moveIdea}
              onCreateParent={createParentAndMove}
              onMoved={(id) => {
                if (id) ideasHook.expandIdea(id);
              }}
              onShowDetails={() => openNotes(p.id)}
              currentView="projects"
            />
            <NotesIndicator hasNotes={!!p.notes?.trim()} onClick={() => openNotes(p.id)} />
            <button
              onClick={() => handleSelect(p.id)}
              className="text-xs font-semibold text-violet-600 hover:underline"
            >
              Open →
            </button>
          </div>
        </div>
        {total > 0 && (
          <div
            className="h-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress for ${p.text || "untitled project"}`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {(() => {
          const expanded = expandedCards.has(p.id);
          if (!expanded) return null;
          const kids = directChildrenOf(p.id);
          const visible = hideCompleted ? kids.filter((k) => k.status !== "completed") : kids;
          const preview = visible.slice(0, 5);
          return (
            <div
              className="mt-1 space-y-1 border-t border-black/5 pt-2 dark:border-white/5"
              onClick={(e) => e.stopPropagation()}
            >
              {preview.length === 0 && (
                <p className="px-1 text-[11px] text-gray-400 italic">No tasks yet</p>
              )}
              {preview.map((t) => (
                <div key={t.id} className="flex items-center gap-2 px-1 text-xs">
                  <input
                    type="checkbox"
                    checked={t.status === "completed"}
                    onChange={() =>
                      void (t.status === "completed" ? markUndone(t.id) : markDone(t.id))
                    }
                    aria-label={`Toggle ${t.text || "untitled task"}`}
                    className="h-3.5 w-3.5 rounded accent-violet-600"
                  />
                  <button
                    onClick={() => handleSelect(p.id)}
                    title="Open in project"
                    className={`min-w-0 flex-1 truncate text-left hover:text-violet-600 ${
                      t.status === "completed"
                        ? "text-gray-400 line-through"
                        : "text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {t.text || "Untitled"}
                  </button>
                  <span className="shrink-0 text-[10px] text-gray-400 capitalize">
                    {t.status.replace("_", " ")}
                  </span>
                </div>
              ))}
              {visible.length > preview.length && (
                <p className="px-1 text-[11px] text-gray-400">
                  +{visible.length - preview.length} more
                </p>
              )}
              <div className="flex gap-2 px-1 pt-1">
                <button
                  onClick={() => void quickAddTaskToProject(p.id)}
                  className="rounded-lg border border-dashed border-black/10 px-2 py-1 text-[11px] font-semibold text-gray-500 hover:border-violet-300 hover:text-violet-600 dark:border-white/10"
                >
                  + Add task
                </button>
                <button
                  onClick={() => handleSelect(p.id)}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-600 hover:bg-violet-50"
                >
                  Open →
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  const renderColumn = (value: string | null, label: string) => {
    const list = groupedProjects.get(value) ?? [];
    const isUnclassified = value === null;
    if (isUnclassified && !unclassifiedExpanded) {
      return (
        <div key="unclassified-collapsed" className="glass-card rounded-2xl">
          <div className="flex w-full items-center justify-between gap-2 px-4 py-3">
            <button
              onClick={() => {
                setPrefs({ projectsUnclassifiedExpanded: true });
              }}
              className="flex flex-1 items-center justify-between text-sm font-semibold text-gray-500"
            >
              <span>Unclassified · {list.length} for triage</span>
              <ChevronUp size={14} className="rotate-180" />
            </button>
            <ValueHelpInfo
              lensKey={lensKey}
              schemeLabel={lensTabs.find((t) => t.key === lensKey)?.label ?? "Group"}
              columns={columns}
              current={null}
              onlyValue={null}
            />
          </div>
        </div>
      );
    }
    const collapseControl = isUnclassified ? (
      <button
        onClick={() => {
          setPrefs({ projectsUnclassifiedExpanded: false });
        }}
        title="Collapse unclassified section"
        aria-label="Collapse unclassified section"
        className="rounded p-0.5 text-gray-400 hover:text-gray-600"
      >
        <ChevronUp size={14} />
      </button>
    ) : undefined;
    return (
      <ColumnShell
        key={groupKeyOf(value)}
        label={label}
        count={list.length}
        collapseControl={collapseControl}
        labelSuffix={
          <ValueHelpInfo
            lensKey={lensKey}
            schemeLabel={lensTabs.find((t) => t.key === lensKey)?.label ?? "Group"}
            columns={columns}
            current={null}
            onlyValue={value}
          />
        }
      >
        <div className="space-y-2 p-3">
          {list.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-gray-400 italic">No projects</p>
          ) : (
            list.map(renderProjectCard)
          )}
          <button
            onClick={() => void handleAddProjectInGroup(value)}
            className="w-full rounded-xl border border-dashed border-black/10 px-3 py-2 text-xs font-semibold text-gray-400 transition hover:border-violet-300 hover:text-violet-600 dark:border-white/10"
          >
            + Add to {label}
          </button>
        </div>
      </ColumnShell>
    );
  };

  const listHeaderStartActions = (
    <>
      <label
        className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 py-1.5 pr-2.5 pl-3 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
        title="Project grouping"
      >
        <span className="hidden sm:inline">By</span>
        <select
          value={lensKey}
          onChange={(e) => handleLensChange(e.target.value)}
          aria-label="Group projects by"
          className="cursor-pointer bg-transparent font-semibold outline-none"
        >
          {lensTabs.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setStatusFilter("open")}
          aria-pressed={statusFilter === "open"}
          className={`toolbar-btn ${statusFilter === "open" ? "toolbar-btn--accent" : ""}`}
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          aria-pressed={statusFilter === "all"}
          className={`toolbar-btn ${statusFilter === "all" ? "toolbar-btn--accent" : ""}`}
        >
          All
        </button>
      </div>
      <button
        type="button"
        onClick={() => setHideCompleted((v) => !v)}
        aria-pressed={hideCompleted}
        title="Hide completed projects"
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          hideCompleted
            ? "border-indigo-300 bg-white text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
            : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
        }`}
      >
        <span className="hidden sm:inline">Hide completed</span>
        <span className="sm:hidden">Hide done</span>
      </button>
    </>
  );

  return (
    <AppShell
      title="Projects"
      headerStartActions={listHeaderStartActions}
      headerActions={
        <button
          onClick={handleAddProject}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
        >
          <Plus size={13} /> New project
        </button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-xs text-gray-400">
          {visibleProjects.length} project{visibleProjects.length !== 1 ? "s" : ""}
        </p>

        {visibleProjects.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <FolderKanban size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">No projects found</p>
            <p className="mt-1 text-xs">
              Create a project in Brainstorm with type &quot;project&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {columns.map((col) => renderColumn(col.key, col.label))}
            {lensKey === "area" && renderColumn(null, "Unclassified")}
          </div>
        )}

        <UndoBar undoAction={undoAction} onUndo={handleUndo} onDismiss={clearUndo} />
      </div>
    </AppShell>
  );
}

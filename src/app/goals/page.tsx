"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Target, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { IdeaTree } from "@/components/brainstorm/IdeaTree";
import { BrainstormBreadcrumb } from "@/components/brainstorm/BrainstormBreadcrumb";
import { useIdeas, type CreateIdeaPosition } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { Idea, LinkType } from "@/lib/types";
import { getAncestorChain, getChildCount, getFocusedSubtreeIds } from "@/lib/ideaTreeFocus";
import { getCompletionEffects, hasAnyEffects, CompletionEffects } from "@/lib/linkEffects";
import { LinkedEffectsReveal } from "@/components/shared/LinkedEffectsReveal";
import { useUndoAction } from "@/lib/tasks/undo";
import { UndoBar } from "@/components/shared/UndoBar";

export default function GoalsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialGoalId = searchParams.get("goalId");

  const [search, setSearch] = useState("");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "active">("active");
  const [selectedId, setSelectedId] = useState<string | null>(initialGoalId);

  const ideasHook = useIdeas({ scope: "all", searchQuery: search });
  const linksHook = useIdeaLinks();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();

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
  const [completionEffects, setCompletionEffects] = useState<{
    effects: CompletionEffects;
    completedText: string;
  } | null>(null);

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("goalId", id);
    else params.delete("goalId");
    const qs = params.toString();
    router.replace(qs ? `/goals?${qs}` : "/goals", { scroll: false });
    if (id) ideasHook.expandIdea(id);
  };

  useEffect(() => {
    const pid = searchParams.get("goalId");
    if (pid !== selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync URL to state
      setSelectedId(pid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle highlight deep-link: auto-select containing goal and pulse highlight
  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    if (!highlightId || ideasHook.loading) return;
    const idea = ideasHook.ideas.find((i) => i.id === highlightId);
    if (!idea) return;
    // Guarantee the highlight target stays visible in the goal list.
    if (["completed", "cancelled", "archived"].includes(idea.status)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- highlight deep-link syncs selection + lifts hiding filters
      setHideCompleted(false);
      setStatusFilter("all");
    }
    const byId = new Map(ideasHook.ideas.map((i) => [i.id, i]));
    let goalId: string | null = null;
    if (idea.type === "objective") goalId = idea.id;
    else {
      let cur: Idea | undefined = idea;
      while (cur?.parent_id) {
        const parent = byId.get(cur.parent_id);
        if (!parent) break;
        if (parent.type === "objective") {
          goalId = parent.id;
          break;
        }
        cur = parent;
      }
    }
    if (goalId) {
      if (goalId !== selectedId) {
        setSelectedId(goalId);
        ideasHook.expandIdea(goalId);
      }
      ideasHook.expandIdea(highlightId);
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
    if (goalId) params.set("goalId", goalId);
    const qs = params.toString();
    router.replace(qs ? `/goals?${qs}` : "/goals", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, ideasHook.loading]);

  useEffect(() => {
    if (selectedId && !ideasHook.loading && !ideasHook.ideas.some((i) => i.id === selectedId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- self-heal deleted goal
      handleSelect(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideasHook.ideas, ideasHook.loading]);

  const goals = useMemo(
    () => ideasHook.ideas.filter((i) => i.type === "objective"),
    [ideasHook.ideas],
  );

  const visibleGoals = useMemo(() => {
    let list = goals;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) => p.text.toLowerCase().includes(q) || (p.notes?.toLowerCase().includes(q) ?? false),
      );
    }
    if (statusFilter === "active") {
      list = list.filter((p) => !["completed", "cancelled", "archived"].includes(p.status));
    }
    if (hideCompleted) {
      list = list.filter((p) => p.status !== "completed");
    }
    return [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [goals, search, statusFilter, hideCompleted]);

  const selectedGoal = useMemo(
    () => (selectedId ? (ideasHook.ideas.find((i) => i.id === selectedId) ?? null) : null),
    [ideasHook.ideas, selectedId],
  );

  const breadcrumbChain = useMemo(
    () => (selectedId ? getAncestorChain(selectedId, ideasHook.ideas) : []),
    [selectedId, ideasHook.ideas],
  );

  const createIdea = async (
    text: string,
    parentId?: string | null,
    position?: CreateIdeaPosition,
    initialUpdates?: Partial<Idea>,
  ): Promise<string> => {
    const id = await ideasHook.createIdea(text, parentId, position, initialUpdates);
    if (id)
      registerUndo({
        label: "Idea created",
        run: async () => {
          await ideasHook.deleteIdea(id);
        },
      });
    return id;
  };

  const updateIdea = async (id: string, updates: Partial<Idea>) => {
    const prev = ideasHook.ideas.find((i) => i.id === id);
    if (updates.status === "completed" && prev && prev.status !== "completed") {
      const effects = getCompletionEffects(id, ideasHook.ideas, linksHook.links);
      await ideasHook.updateIdea(id, updates);
      const restore: Partial<Idea> = {};
      for (const k of Object.keys(updates) as Array<keyof Idea>) restore[k] = prev[k] as never;
      registerUndo({
        label: "Idea updated",
        run: async () => {
          await ideasHook.updateIdea(id, restore);
        },
      });
      if (hasAnyEffects(effects)) setCompletionEffects({ effects, completedText: prev.text });
      return;
    }
    await ideasHook.updateIdea(id, updates);
    if (!prev) return;
    const restore: Partial<Idea> = {};
    for (const k of Object.keys(updates) as Array<keyof Idea>) restore[k] = prev[k] as never;
    registerUndo({
      label: "Idea updated",
      run: async () => {
        await ideasHook.updateIdea(id, restore);
      },
    });
  };

  const deleteIdea = async (id: string) => {
    const deletedIds = getFocusedSubtreeIds(id, ideasHook.ideas);
    const deletedIdeas = ideasHook.ideas.filter((i) => deletedIds.has(i.id));
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
    if (selectedId && deletedIds.has(selectedId)) handleSelect(null);
  };

  const moveIdea = async (id: string, newParentId: string | null, newSortOrder: number) => {
    const prev = ideasHook.ideas.find((i) => i.id === id);
    await ideasHook.moveIdea(id, newParentId, newSortOrder);
    if (!prev) return;
    registerUndo({
      label: "Idea moved",
      run: async () => {
        await ideasHook.moveIdea(id, prev.parent_id, prev.sort_order);
      },
    });
  };

  const createLink = async (s: string, t: string, type: LinkType): Promise<string> => {
    const id = await linksHook.createLink(s, t, type);
    if (id)
      registerUndo({
        label: "Link created",
        run: async () => {
          await linksHook.deleteLink(id);
        },
      });
    return id;
  };
  const deleteLink = async (id: string) => {
    const del = linksHook.links.find((l) => l.id === id);
    await linksHook.deleteLink(id);
    if (!del) return;
    registerUndo({
      label: "Link deleted",
      run: async () => {
        await linksHook.restoreLinks([del]);
      },
    });
  };
  const markDone = async (id: string) => {
    const prev = ideasHook.ideas.find((i) => i.id === id);
    const effects = getCompletionEffects(id, ideasHook.ideas, linksHook.links);
    await ideasHook.markDone(id);
    if (!prev) return;
    registerUndo({
      label: "Idea completed",
      run: async () => {
        await ideasHook.updateIdea(id, { status: prev.status, completed_at: prev.completed_at });
      },
    });
    if (hasAnyEffects(effects)) setCompletionEffects({ effects, completedText: prev.text });
  };
  const markUndone = async (id: string) => {
    const prev = ideasHook.ideas.find((i) => i.id === id);
    await ideasHook.markUndone(id);
    if (!prev) return;
    registerUndo({
      label: "Idea reopened",
      run: async () => {
        await ideasHook.updateIdea(id, { status: prev.status, completed_at: prev.completed_at });
      },
    });
  };
  const scheduleIdea = async (id: string, date: string | null) => {
    const prev = ideasHook.ideas.find((i) => i.id === id);
    await ideasHook.scheduleIdea(id, date);
    if (!prev) return;
    registerUndo({
      label: date ? "Idea scheduled" : "Schedule cleared",
      run: async () => {
        await ideasHook.updateIdea(id, { scheduled_date: prev.scheduled_date });
      },
    });
  };

  const handleAddTask = async () => {
    if (!selectedId) return;
    const id = await createIdea("", selectedId, "bottom", { type: "task", status: "draft" });
    if (id) {
      ideasHook.expandIdea(selectedId);
      setSelectedTreeId(id);
      setEditingId(id);
    }
  };

  if (ideasHook.loading) {
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

  // List view — all goals
  return (
    <AppShell title="Goals">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search
              size={14}
              className="absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search goals..."
              className="w-full rounded-xl border border-black/10 bg-white/60 py-2 pr-3 pl-8 text-sm placeholder:text-gray-300 focus:ring-2 focus:ring-violet-500/30 focus:outline-none dark:border-white/10 dark:bg-gray-800/60 dark:placeholder:text-gray-500"
            />
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setStatusFilter("active")}
              className={`toolbar-btn ${statusFilter === "active" ? "toolbar-btn--accent" : ""}`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`toolbar-btn ${statusFilter === "all" ? "toolbar-btn--accent" : ""}`}
            >
              All
            </button>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
              className="rounded"
            />
            Hide completed
          </label>
        </div>

        <p className="text-xs text-gray-400">
          {visibleGoals.length} goal{visibleGoals.length !== 1 ? "s" : ""}
        </p>

        {visibleGoals.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Target size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">No goals found</p>
            <p className="mt-1 text-xs">
              Create a goal in Brainstorm with type &quot;objective&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleGoals.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                className="glass-card flex w-full cursor-pointer items-center justify-between rounded-2xl border border-black/5 px-4 py-3 text-left transition hover:border-violet-200 dark:border-white/5 dark:hover:border-violet-800"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/30">
                    <Target size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {p.text || "Untitled goal"}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {p.status.replace("_", " ")} · {getChildCount(p.id, ideasHook.ideas)} tasks
                      {p.scheduled_date ? ` · ${p.scheduled_date}` : ""}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-violet-600">Open →</span>
              </button>
            ))}
          </div>
        )}

        <UndoBar undoAction={undoAction} onUndo={handleUndo} onDismiss={clearUndo} />
      </div>
    </AppShell>
  );
}

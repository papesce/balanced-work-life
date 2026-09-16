"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useIdeas, type CreateIdeaPosition } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { AppShell } from "@/components/AppShell";
import { IdeaTree } from "@/components/brainstorm/IdeaTree";
import { BrainstormToolbar } from "@/components/brainstorm/BrainstormToolbar";
import { BrainstormBreadcrumb } from "@/components/brainstorm/BrainstormBreadcrumb";
import { GraphView } from "@/components/brainstorm/GraphView";
import { Idea, LinkType } from "@/lib/types";
import { STORAGE_KEYS, readRawString, writeRawString } from "@/lib/storage";
import { getAncestorChain, getFocusedSubtreeIds } from "@/lib/ideaTreeFocus";
import { getCompletionEffects, hasAnyEffects, CompletionEffects } from "@/lib/linkEffects";
import { LinkedEffectsReveal, LinkedEffectsBadge } from "@/components/shared/LinkedEffectsReveal";
import type { IdeasScope } from "@/hooks/useIdeas";
import { useSearchParams, useRouter } from "next/navigation";
import { useUndoAction } from "@/lib/tasks/undo";

export default function BrainstormPage() {
  const [timeScope, setTimeScope] = useState<IdeasScope>("this_month");
  const [search, setSearch] = useState("");
  const ideasHook = useIdeas({ scope: timeScope, searchQuery: search });
  const linksHook = useIdeaLinks();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightId = searchParams.get("highlight");
  const [viewMode, setViewMode] = useState<"tree" | "graph">("tree");
  const [cardMode, setCardMode] = useState(
    () => readRawString(STORAGE_KEYS.brainstormCardMode) === "true",
  );
  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();
  const [completionEffects, setCompletionEffects] = useState<{
    effects: CompletionEffects;
    completedText: string;
  } | null>(null);

  type EditMode = "view" | "edit" | "insert";
  const [editMode, setEditMode] = useState<EditMode>(() => {
    const saved = readRawString(STORAGE_KEYS.brainstormEditMode);
    return saved === "edit" || saved === "insert" ? saved : "view";
  });
  const changeEditMode = (mode: EditMode) => {
    setEditMode(mode);
    writeRawString(STORAGE_KEYS.brainstormEditMode, mode);
    if (mode !== "edit") setEditingId(null);
    if (mode === "view") setComposing(null);
  };

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
  const [hideCompleted, setHideCompleted] = useState(false);
  const [hideDeferred, setHideDeferred] = useState(false);

  const [focusedId, setFocusedId] = useState<string | null>(() => {
    const saved = readRawString(STORAGE_KEYS.brainstormFocusId);
    return saved ? saved : null;
  });

  useEffect(() => {
    writeRawString(STORAGE_KEYS.brainstormFocusId, focusedId ?? "");
  }, [focusedId]);

  useEffect(() => {
    writeRawString(STORAGE_KEYS.brainstormCardMode, String(cardMode));
  }, [cardMode]);

  useEffect(() => {
    if (cardMode && editMode !== "view") {
      /* eslint-disable react-hooks/set-state-in-effect -- sync editMode to cardMode */
      setEditMode("view");
      writeRawString(STORAGE_KEYS.brainstormEditMode, "view");
      setEditingId(null);
      setComposing(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [cardMode, editMode]);

  // Search spans every idea: focus is suspended while a search is active.
  // Focus also self-heals when the focused idea no longer exists (deleted).
  const searchActive = search.trim().length > 0;
  const focusValid = focusedId !== null && ideasHook.ideas.some((i) => i.id === focusedId);
  const effectiveFocusId = searchActive || !focusValid ? null : focusedId;

  const focusedIdea = useMemo(
    () => ideasHook.ideas.find((idea) => idea.id === effectiveFocusId) ?? null,
    [ideasHook.ideas, effectiveFocusId],
  );
  const breadcrumbChain = useMemo(
    () => (effectiveFocusId ? getAncestorChain(effectiveFocusId, ideasHook.ideas) : []),
    [effectiveFocusId, ideasHook.ideas],
  );

  const handleFocus = (id: string | null) => {
    setFocusedId(id);
    if (id) ideasHook.expandIdea(id);
  };

  const hasLinks = linksHook.links.length > 0;

  const handleAddRoot = async () => {
    const id = await createIdea("", effectiveFocusId, "top");
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
    if (updates.status === "completed" && previous && previous.status !== "completed") {
      const effects = getCompletionEffects(id, ideasHook.ideas, linksHook.links);
      await ideasHook.updateIdea(id, updates);
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
      if (hasAnyEffects(effects)) setCompletionEffects({ effects, completedText: previous.text });
      return;
    }
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
    const deletedIds = getFocusedSubtreeIds(id, ideasHook.ideas);
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
    // Compute effects BEFORE status flips to completed (uses current statuses)
    const effects = getCompletionEffects(id, ideasHook.ideas, linksHook.links);
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
    if (hasAnyEffects(effects)) {
      setCompletionEffects({ effects, completedText: previous.text });
    }
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

  useEffect(() => {
    if (!highlightId || ideasHook.loading) return;
    const idea = ideasHook.ideas.find((i) => i.id === highlightId);
    if (!idea) return;
    // expand ancestors so node is visible
    const chain = getAncestorChain(highlightId, ideasHook.ideas);
    for (const anc of chain) ideasHook.expandIdea(anc.id);
    ideasHook.expandIdea(highlightId);
    /* eslint-disable react-hooks/set-state-in-effect -- highlight deep-link syncs selection/view */
    setSelectedId(highlightId);
    setViewMode("tree");
    /* eslint-enable react-hooks/set-state-in-effect */
    const timer = setTimeout(() => {
      const el = document.getElementById(`idea-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-pulse");
        const cleanup = () => el.classList.remove("highlight-pulse");
        el.addEventListener("animationend", cleanup, { once: true });
        setTimeout(cleanup, 2500);
      }
      const params = new URLSearchParams(searchParams.toString());
      params.delete("highlight");
      router.replace(`/brainstorm?${params.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run only on highlightId/loading change
  }, [highlightId, ideasHook.loading]);

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
      editMode={editMode}
      setEditMode={changeEditMode}
      cardMode={cardMode}
      showType={showType}
      setShowType={setShowType}
      showArea={showArea}
      setShowArea={setShowArea}
      showToday={showToday}
      setShowToday={setShowToday}
      hideClosed={hideClosed}
      setHideClosed={setHideClosed}
      hideCompleted={hideCompleted}
      setHideCompleted={setHideCompleted}
      hideDeferred={hideDeferred}
      setHideDeferred={setHideDeferred}
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
      {viewMode === "tree" && (
        <>
          <button
            onClick={() => setCardMode((v: boolean) => !v)}
            className={`toolbar-btn ${cardMode ? "toolbar-btn--accent" : ""}`}
            title={cardMode ? "Show rows" : "Show cards"}
            aria-pressed={cardMode}
          >
            {cardMode ? "Rows" : "Cards"}
          </button>
          <span className="text-gray-200">|</span>
        </>
      )}
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
      fullWidth={viewMode !== "tree"}
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
          {completionEffects && hasAnyEffects(completionEffects.effects) && (
            <LinkedEffectsBadge effects={completionEffects.effects} />
          )}
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
      {completionEffects && hasAnyEffects(completionEffects.effects) && (
        <div className="mx-auto mt-3 max-w-3xl">
          <LinkedEffectsReveal
            effects={completionEffects.effects}
            completedText={completionEffects.completedText}
            onClose={() => setCompletionEffects(null)}
          />
        </div>
      )}
      {effectiveFocusId && focusedIdea && (
        <div className="mb-3">
          <BrainstormBreadcrumb
            chain={breadcrumbChain}
            focused={focusedIdea}
            onSelect={handleFocus}
          />
        </div>
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
          editMode={editMode}
          editingId={editingId}
          setEditingId={setEditingId}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          composing={composing}
          setComposing={setComposing}
          showToday={showToday}
          hideClosed={hideClosed}
          hideCompleted={hideCompleted}
          hideDeferred={hideDeferred}
          focusedId={effectiveFocusId}
          onFocus={handleFocus}
          cardMode={cardMode}
        />
      ) : (
        <GraphView
          ideas={ideasHook.ideas}
          links={linksHook.links}
          focusedId={effectiveFocusId}
          onNodeDoubleClick={(ideaId) => {
            handleFocus(ideaId);
            setViewMode("tree");
          }}
        />
      )}
    </AppShell>
  );
}

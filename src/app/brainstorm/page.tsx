"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useIdeas } from "@/hooks/useIdeas";
import { useClassifications } from "@/hooks/useClassifications";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { AppShell } from "@/components/AppShell";
import { IdeaTree } from "@/components/brainstorm/IdeaTree";
import {
  BrainstormActions,
  BrainstormStartActions,
} from "@/components/brainstorm/BrainstormHeaders";
import { BrainstormBreadcrumb } from "@/components/brainstorm/BrainstormBreadcrumb";
import { GraphView } from "@/components/brainstorm/GraphView";
import { IdeaType } from "@/lib/types";
import { STORAGE_KEYS, readRawString, writeRawString } from "@/lib/storage";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import { getAncestorChain, getFocusedSubtreeIds } from "@/lib/ideaTreeFocus";
import { hasAnyEffects } from "@/lib/linkEffects";
import { useCompletionEffects } from "@/stores/feedbackStore";
import { LinkedEffectsReveal, LinkedEffectsBadge } from "@/components/shared/LinkedEffectsReveal";
import type { IdeasScope } from "@/hooks/useIdeas";
import { useSearchParams, useRouter } from "next/navigation";
import { useUndoAction } from "@/lib/tasks/undo";
import { useBrainstormMutations } from "@/hooks/useBrainstormMutations";

export default function BrainstormPage() {
  const [timeScope, setTimeScope] = useState<IdeasScope>("this_month");
  const ideasHook = useIdeas({ scope: timeScope });
  const linksHook = useIdeaLinks();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightId = searchParams.get("highlight");
  const [viewMode, setViewMode] = useState<"tree" | "graph">("tree");
  const cardMode = useUiPrefsStore((s) => s.cardMode);
  const setPrefs = useUiPrefsStore((s) => s.set);
  const setCardMode = (v: boolean | ((p: boolean) => boolean)) =>
    setPrefs({ cardMode: typeof v === "function" ? v(cardMode) : v });
  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();
  const { completionEffects, setCompletionEffects } = useCompletionEffects();

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
  const [hideInHorizon, setHideInHorizon] = useState(
    () => readRawString(STORAGE_KEYS.brainstormHideInHorizon) === "true",
  );
  const [typeFilter, setTypeFilter] = useState<IdeaType[]>([]);
  const { classifications } = useClassifications();
  const classifiedIds = useMemo(
    () => new Set(classifications.map((c) => c.idea_id)),
    [classifications],
  );

  const [focusedId, setFocusedId] = useState<string | null>(() => {
    const saved = readRawString(STORAGE_KEYS.brainstormFocusId);
    return saved ? saved : null;
  });

  useEffect(() => {
    writeRawString(STORAGE_KEYS.brainstormFocusId, focusedId ?? "");
  }, [focusedId]);

  // cardMode persists via uiPrefsStore (shared with horizon).

  useEffect(() => {
    writeRawString(STORAGE_KEYS.brainstormHideInHorizon, String(hideInHorizon));
  }, [hideInHorizon]);

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

  // Focus self-heals when the focused idea no longer exists (deleted).
  const focusValid = focusedId !== null && ideasHook.ideas.some((i) => i.id === focusedId);
  const effectiveFocusId = !focusValid ? null : focusedId;

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
  } = useBrainstormMutations({
    ideasApi: ideasHook,
    linksApi: linksHook,
    registerUndo,
    setCompletionEffects,
  });

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
    // Guarantee the highlight target is visible: lift filters that could hide it.
    if (focusedId && !getFocusedSubtreeIds(focusedId, ideasHook.ideas).has(highlightId)) {
      setFocusedId(null);
    }
    if (
      hideClosed &&
      (idea.status === "cancelled" || idea.status === "missed" || idea.status === "archived")
    ) {
      setHideClosed(false);
    }
    if (hideCompleted && idea.status === "completed") setHideCompleted(false);
    if (hideDeferred && idea.status === "deferred") setHideDeferred(false);
    if (hideInHorizon && classifiedIds.has(highlightId)) setHideInHorizon(false);
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
    <BrainstormStartActions
      editMode={editMode}
      onEditModeChange={changeEditMode}
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
      hideInHorizon={hideInHorizon}
      setHideInHorizon={setHideInHorizon}
      typeFilter={typeFilter}
      setTypeFilter={setTypeFilter}
      onAddRoot={() => void handleAddRoot()}
      onExpandAll={ideasHook.expandAll}
      onCollapseAll={ideasHook.collapseAll}
    />
  );

  const headerActions = (
    <BrainstormActions
      cardMode={cardMode}
      onToggleCardMode={() => setCardMode((v: boolean) => !v)}
      timeScope={timeScope}
      onTimeScopeChange={setTimeScope}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      hasLinks={hasLinks}
    />
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
          hideInHorizonIds={hideInHorizon ? classifiedIds : undefined}
          typeFilter={typeFilter}
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

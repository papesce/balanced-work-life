"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useEffect } from "react";
import { useIdeas } from "@/hooks/useIdeas";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useUndoAction } from "@/lib/tasks/undo";
import { AppShell } from "@/components/AppShell";
import { UndoBar } from "@/components/shared/UndoBar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HorizonColumn } from "@/components/horizon/HorizonColumn";
import { RootAddInput } from "@/components/horizon/RootAddInput";
import { LensEditPanel } from "@/components/horizon/LensEditPanel";
import { HorizonBoardColumns } from "@/components/horizon/HorizonBoardColumns";
import { HorizonBoardHeader } from "@/components/horizon/HorizonBoardHeader";
import { IdeaType } from "@/lib/types";
import { useClassifications } from "@/hooks/useClassifications";
import { useHorizonPrefs, type UseHorizonPrefsResult } from "@/hooks/useHorizonPrefs";
import { useHorizonUrl } from "@/hooks/useHorizonUrl";
import { useHorizonSelection } from "@/hooks/useHorizonSelection";
import { useHorizonLensSession } from "@/hooks/useHorizonLensSession";
import { useHorizonCollapse } from "@/hooks/useHorizonCollapse";
import { useHorizonGrouping } from "@/hooks/useHorizonGrouping";
import { useHorizonMutations } from "@/hooks/useHorizonMutations";
import { STORAGE_KEYS, writeTreeOverrides } from "@/lib/storage";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";

import { ACTIVE_STATUSES, buildFilteredTree } from "@/lib/horizonBoard";
import { UNCLASSIFIED, groupKeyOf, type LensColumn } from "@/components/lens";
import { isOverdueCommitted, isUpcomingCommitted } from "@/lib/horizonScope";
import { type HorizonLensDef } from "@/lib/horizonLenses";

export default function HorizonPage() {
  const prefs = useHorizonPrefs();
  if (prefs.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading horizon...</div>
      </div>
    );
  }
  return <HorizonBoard prefs={prefs} />;
}

function HorizonBoard({ prefs }: { prefs: UseHorizonPrefsResult }) {
  const {
    views,
    defaultViewId: dbDefaultViewId,
    defaultLensId: dbDefaultLensId,
    secondaryMap: dbSecondaryMap,
  } = prefs;
  const ideasHook = useIdeas();
  const { ideas, loading, moveIdea, scheduleIdea } = ideasHook;
  const ideasRef = useRef(ideas);
  useEffect(() => {
    ideasRef.current = ideas;
  });
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const linksHook = useIdeaLinks();
  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();
  const [activeTab, setActiveTab] = useState<string>("short");
  const { setOverrides, collapsedIds, onToggleCollapse, onExpandIdea } = useHorizonCollapse(ideas);
  const [hideClosed, setHideClosed] = useState(true);
  const [typeFilter, setTypeFilter] = useState<IdeaType[]>([]);
  const cardMode = useUiPrefsStore((s) => s.cardMode);
  const hideProjectsWithTasks = useUiPrefsStore((s) => s.horizonHideProjectsWithTasks);
  const hideUpcomingPref = useUiPrefsStore((s) => s.horizonHideUpcomingCommitted);
  const hideOverduePref = useUiPrefsStore((s) => s.horizonHideOverdueCommitted);
  const showClassificationOrder = useUiPrefsStore((s) => s.horizonShowClassificationOrder ?? true);
  const unclassifiedExpanded = useUiPrefsStore((s) => s.horizonUnclassifiedExpanded);
  const setPrefs = useUiPrefsStore((s) => s.set);
  const setCardMode = (v: boolean | ((p: boolean) => boolean)) =>
    setPrefs({ cardMode: typeof v === "function" ? v(cardMode) : v });
  const setUnclassifiedExpanded = (v: boolean | ((p: boolean) => boolean)) =>
    setPrefs({
      horizonUnclassifiedExpanded: typeof v === "function" ? v(unclassifiedExpanded) : v,
    });
  const {
    schemes,
    options: classificationOptions,
    classifications,
    setClassification,
    isLoading: classificationsLoading,
  } = useClassifications();
  const { updateParams, setLensParam, lensParam, horizonParam, highlightId } = useHorizonUrl();
  const selection = useHorizonSelection({
    views,
    dbDefaultViewId,
    dbDefaultLensId,
    dbSecondaryMap,
    prefs,
    schemes,
    classificationOptions,
    classifications,
    lensParam,
    setLensParam,
  });
  const {
    lensKey,
    activeViewId,
    valuesBySchemeKey,
    schemeByKey,
    activeScheme,
    optionsBySchemeId,
    columns,
    valueOf,
    lens,
    lensSynthesized,
    secondaryKeyOf,
    secondaryValueOf,
    displayLenses,
    activeView,
    selectView,
    selectLens,
    deleteView,
    toggleDefaultView,
    toggleDefaultLens,
    defaultViewId,
    defaultLensId,
  } = selection;
  const session = useHorizonLensSession({
    selection,
    views,
    prefs,
    schemes,
    setLensParam,
    updateParams,
  });
  const {
    menuEditingId,
    draftName,
    setDraftName,
    draftDescription,
    setDraftDescription,
    nameAutoFocus,
    primaryOptions,
    primaryLocked,
    hasUnsavedEdits,
    leaveEditSession,
    leaveConfirmOpen,
    confirmLeave,
    cancelLeave,
    startMenuEdit,
    createLens,
    saveLensEdits,
    primaryChangeLive,
    splitChangeLive,
  } = session;

  const orderedSchemes = useMemo(
    () => [...schemes].sort((a, b) => a.sort_order - b.sort_order),
    [schemes],
  );
  /** Group-by candidates for the per-column Split selects (active lens excluded). */
  const splitSchemeOptions = useMemo(
    () =>
      orderedSchemes
        .filter((scheme) => scheme.key !== lensKey)
        .map((scheme) => ({ key: scheme.key, label: scheme.label })),
    [orderedSchemes, lensKey],
  );

  const validTabs = useMemo(() => new Set(columns.map((c) => groupKeyOf(c.key))), [columns]);

  // cardMode persists via uiPrefsStore (no per-change localStorage write needed).

  const {
    updateIdea,
    deleteIdea,
    createIdea,
    handleSetValue,
    handleSetPriority,
    handleSetSecondary,
    handleAdd,
  } = useHorizonMutations({
    ideasHook,
    linksHook,
    setClassification,
    registerUndo,
    lensKey,
    activeSchemeLabel: activeScheme?.label ?? lensKey,
    valueOf,
    priorityOf: (id) => valuesBySchemeKey.get("priority")?.get(id) ?? null,
    secondaryLabelOf: (key) => schemeByKey.get(key)?.label ?? key,
    secondaryValueOfId: (key, id) => valuesBySchemeKey.get(key)?.get(id) ?? null,
  });

  const allTreeNodes = useMemo(
    () =>
      buildFilteredTree(
        ideas,
        collapsedIds,
        hideClosed,
        hideProjectsWithTasks,
        hideUpcomingPref,
        hideOverduePref,
      ),
    [ideas, collapsedIds, hideClosed, hideProjectsWithTasks, hideUpcomingPref, hideOverduePref],
  );

  const {
    priorityOf,
    promotedByParent,
    columnLabelByKey,
    filteredTreesByLens,
    secondaryByPrimary,
  } = useHorizonGrouping({
    allTreeNodes,
    columns,
    typeFilter,
    valueOf,
    valuesBySchemeKey,
    secondaryKeyOf,
    schemeByKey,
    optionsBySchemeId,
  });

  const toggleUnclassified = () => {
    setUnclassifiedExpanded(!unclassifiedExpanded);
  };

  // Selection actions are guarded by the edit session: switching lens/view
  // mid-edit asks to discard first.
  const handleSelectView = useCallback(
    async (id: string) => {
      if (!(await leaveEditSession())) return;
      selectView(id);
    },
    [leaveEditSession, selectView],
  );

  const handleSelectLens = useCallback(
    async (next: HorizonLensDef) => {
      if (!(await leaveEditSession())) return;
      selectLens(next);
    },
    [leaveEditSession, selectLens],
  );

  // Sync mobile tab from ?horizon=, and repair the tab whenever the columns
  // change underneath it (lens switch, classifications loading).
  useEffect(() => {
    if (horizonParam && validTabs.has(horizonParam)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync tab from URL param
      setActiveTab(horizonParam);
    } else if (!validTabs.has(activeTab)) {
      setActiveTab(columns[0] ? groupKeyOf(columns[0].key) : UNCLASSIFIED);
    }
  }, [horizonParam, validTabs, columns, activeTab]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const currentIdeas = ideasRef.current;
    const idea = currentIdeas.find((i) => i.id === highlightId);
    if (idea) setActiveTab(groupKeyOf(valueOf(idea.id)));
    // Guarantee an unclassified highlight target is visible: expand the strip.
    if (idea && valueOf(idea.id) == null) {
      setPrefs({ horizonUnclassifiedExpanded: true });
    }
    // Guarantee the highlight target is visible: lift filters that could hide it.
    if (idea && !ACTIVE_STATUSES.has(idea.status)) {
      setHideClosed(false);
    }
    if (idea && isUpcomingCommitted(idea) && hideUpcomingPref) {
      setPrefs({ horizonHideUpcomingCommitted: false });
    }
    if (idea && isOverdueCommitted(idea) && hideOverduePref) {
      setPrefs({ horizonHideOverdueCommitted: false });
    }
    if (idea && idea.type) {
      setTypeFilter([]);
    }
    if (idea && idea.type === "project" && hideProjectsWithTasks) {
      setPrefs({ horizonHideProjectsWithTasks: false });
    }
    const expandAncestors = (id: string) => {
      const m = new Map(currentIdeas.map((i) => [i.id, i]));
      let cur = m.get(id);
      const ids: string[] = [];
      while (cur?.parent_id) {
        ids.push(cur.parent_id);
        cur = m.get(cur.parent_id);
      }
      if (ids.length > 0) {
        setOverrides((prev) => {
          const next = new Map(prev);
          for (const anc of ids) next.set(anc, "expanded");
          writeTreeOverrides(STORAGE_KEYS.horizonTreeOverrides, next);
          return next;
        });
      }
    };
    expandAncestors(highlightId);
    const timer = setTimeout(() => {
      const el = document.getElementById(`idea-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-pulse");
        const cleanup = () => el.classList.remove("highlight-pulse");
        el.addEventListener("animationend", cleanup, { once: true });
        setTimeout(cleanup, 2500);
      }
      updateParams((params) => {
        params.delete("highlight");
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [
    highlightId,
    loading,
    updateParams,
    valueOf,
    setPrefs,
    setOverrides,
    hideProjectsWithTasks,
    hideUpcomingPref,
    hideOverduePref,
  ]);

  // Primary-only order hint (read-only): "Attention: 1 Ready to complete → 2 …".
  if (loading || classificationsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading horizon...</div>
      </div>
    );
  }

  const renderColumn = (col: LensColumn) => {
    const nodes = filteredTreesByLens[groupKeyOf(col.key)] ?? [];
    const secondaryKey = secondaryKeyOf(col.key);
    const secondaryScheme = secondaryKey ? (schemeByKey.get(secondaryKey) ?? null) : null;
    const secondaryOptions = secondaryScheme
      ? ((optionsBySchemeId.get(secondaryScheme.id) ?? []).map((o) => ({
          key: o.value,
          label: o.label,
        })) as { key: string; label: string }[])
      : [];
    // Read-only split classification name for this column (values omitted).
    const secondarySplitName = secondaryScheme?.label ?? null;
    return (
      <HorizonColumn
        col={col}
        count={nodes.length}
        unclassifiedExpanded={unclassifiedExpanded}
        onToggleUnclassified={toggleUnclassified}
        editSessionActive={menuEditingId != null}
        secondaryKey={secondaryKey}
        splitOptions={splitSchemeOptions}
        onSplitChange={splitChangeLive}
        secondarySplitName={secondarySplitName}
        showClassificationOrder={showClassificationOrder}
        footer={
          !secondaryKey ? (
            <RootAddInput label={col.label} onAdd={handleAdd(col.key)} suggestFrom={ideas} />
          ) : undefined
        }
        treeProps={{
          nodes,
          ideas,
          lensKey,
          groupValue: col.key,
          onSetValue: handleSetValue,
          secondaryKey,
          secondaryOptions,
          secondaryLabel: secondaryScheme?.label,
          secondaryValueOf: secondaryValueOf(secondaryKey),
          onSetSecondary: secondaryKey
            ? (id, value) => handleSetSecondary(secondaryKey, id, value)
            : undefined,
          onAddSecondary: secondaryKey
            ? (text, type, secVal) => handleAdd(col.key, secondaryKey)(text, type, secVal)
            : undefined,
          collapsed: col.key === null && !unclassifiedExpanded,
          onToggleCollapsed: toggleUnclassified,
          groupLabel: col.label,
          cardMode,
          promotedByParent,
          columnLabelByKey,
          secondaryGrouped: secondaryByPrimary[groupKeyOf(col.key)]?.grouped,
          secondaryPromotedByParent: secondaryByPrimary[groupKeyOf(col.key)]?.promoted,
          secondaryLabelByValue: secondaryByPrimary[groupKeyOf(col.key)]?.labelByValue,
          allTags: tagsHook.tags,
          links: linksHook.links,
          getTagsForIdea: taskTagsHook.getTagsForIdea,
          onUpdate: updateIdea,
          onDelete: deleteIdea,
          onSchedule: scheduleIdea,
          onMove: moveIdea,
          onCreateLink: linksHook.createLink,
          onDeleteLink: linksHook.deleteLink,
          onAddTag: taskTagsHook.addTagToTask,
          onRemoveTag: taskTagsHook.removeTagFromTask,
          onCreateTag: tagsHook.createTag,
          createIdea,
          onToggleCollapse,
          onExpand: onExpandIdea,
          priorityValueOf: priorityOf,
          onSetPriority: handleSetPriority,
          emptyMessage: (
            <p className="px-4 py-6 text-center text-xs text-gray-400 italic dark:text-gray-500">
              No items yet
            </p>
          ),
        }}
      />
    );
  };

  const headerStartActions = (
    <HorizonBoardHeader
      views={views}
      activeViewId={activeViewId}
      defaultViewId={defaultViewId}
      displayLenses={displayLenses}
      activeLensId={!activeView && !lensSynthesized ? lens.id : null}
      defaultLensId={defaultLensId}
      schemes={schemes}
      onSelectView={handleSelectView}
      onDeleteView={deleteView}
      onToggleDefaultView={toggleDefaultView}
      onSelectLens={handleSelectLens}
      onToggleDefaultLens={toggleDefaultLens}
      onCreateLens={createLens}
      onStartEdit={startMenuEdit}
      showClassificationOrder={showClassificationOrder}
      onToggleShowClassificationOrder={() =>
        setPrefs({ horizonShowClassificationOrder: !showClassificationOrder })
      }
      hideClosed={hideClosed}
      onToggleHideClosed={() => setHideClosed((v) => !v)}
      hideUpcoming={hideUpcomingPref}
      onToggleHideUpcoming={() => setPrefs({ horizonHideUpcomingCommitted: !hideUpcomingPref })}
      hideOverdue={hideOverduePref}
      onToggleHideOverdue={() => setPrefs({ horizonHideOverdueCommitted: !hideOverduePref })}
      hideProjectsWithTasks={hideProjectsWithTasks}
      onToggleHideProjectsWithTasks={() =>
        setPrefs({ horizonHideProjectsWithTasks: !hideProjectsWithTasks })
      }
      typeFilter={typeFilter}
      onToggleTypeFilter={(type) =>
        setTypeFilter((prev) =>
          prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
        )
      }
      onClearTypeFilter={() => setTypeFilter([])}
      cardMode={cardMode}
      onToggleCardMode={() => setCardMode((v) => !v)}
    />
  );

  return (
    <AppShell title="Horizon" headerStartActions={headerStartActions}>
      {menuEditingId != null && (
        <LensEditPanel
          draftName={draftName}
          draftDescription={draftDescription}
          onDraftNameChange={setDraftName}
          onDraftDescriptionChange={setDraftDescription}
          primaryOptions={primaryOptions}
          livePrimary={lensKey}
          onPrimaryChange={primaryChangeLive}
          primaryLocked={primaryLocked}
          hasUnsavedEdits={hasUnsavedEdits}
          nameAutoFocus={nameAutoFocus}
          onSave={saveLensEdits}
          onCancel={() => void leaveEditSession()}
        />
      )}
      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Discard lens changes?"
        body="Discard your unsaved lens changes and leave the editor?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
      <UndoBar undoAction={undoAction} onUndo={() => void handleUndo()} onDismiss={clearUndo} />

      <HorizonBoardColumns
        columns={columns}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        renderColumn={renderColumn}
      />
    </AppShell>
  );
}

"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  BrainstormToolbar,
  type BrainstormEditMode,
} from "@/components/brainstorm/BrainstormToolbar";
import type { IdeasScope } from "@/hooks/useIdeas";
import type { IdeaType } from "@/lib/types";

export type { BrainstormEditMode };

interface BrainstormStartActionsProps {
  editMode: BrainstormEditMode;
  onEditModeChange: (mode: BrainstormEditMode) => void;
  cardMode: boolean;
  showType: boolean;
  setShowType: (v: boolean) => void;
  showArea: boolean;
  setShowArea: (v: boolean) => void;
  showToday: boolean;
  setShowToday: (v: boolean) => void;
  hideClosed: boolean;
  setHideClosed: (v: boolean) => void;
  hideCompleted: boolean;
  setHideCompleted: (v: boolean) => void;
  hideDeferred: boolean;
  setHideDeferred: (v: boolean) => void;
  hideInHorizon: boolean;
  setHideInHorizon: (v: boolean) => void;
  typeFilter: IdeaType[];
  setTypeFilter: Dispatch<SetStateAction<IdeaType[]>>;
  activeFilterCount?: number;
  onResetFilters?: () => void;
  onAddRoot: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function BrainstormStartActions(props: BrainstormStartActionsProps) {
  return (
    <BrainstormToolbar
      editMode={props.editMode}
      setEditMode={props.onEditModeChange}
      cardMode={props.cardMode}
      showType={props.showType}
      setShowType={props.setShowType}
      showArea={props.showArea}
      setShowArea={props.setShowArea}
      showToday={props.showToday}
      setShowToday={props.setShowToday}
      hideClosed={props.hideClosed}
      setHideClosed={props.setHideClosed}
      hideCompleted={props.hideCompleted}
      setHideCompleted={props.setHideCompleted}
      hideDeferred={props.hideDeferred}
      setHideDeferred={props.setHideDeferred}
      hideInHorizon={props.hideInHorizon}
      setHideInHorizon={props.setHideInHorizon}
      typeFilter={props.typeFilter}
      setTypeFilter={props.setTypeFilter}
      activeFilterCount={props.activeFilterCount}
      onResetFilters={props.onResetFilters}
      onAddRoot={props.onAddRoot}
      expandAll={props.onExpandAll}
      collapseAll={props.onCollapseAll}
    />
  );
}

export function BrainstormActions({
  cardMode,
  onToggleCardMode,
  timeScope,
  onTimeScopeChange,
  viewMode,
  onViewModeChange,
  hasLinks,
}: {
  cardMode: boolean;
  onToggleCardMode: () => void;
  timeScope: IdeasScope;
  onTimeScopeChange: (scope: IdeasScope) => void;
  viewMode: "tree" | "graph";
  onViewModeChange: (mode: "tree" | "graph") => void;
  hasLinks: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        <button
          onClick={() => onTimeScopeChange("this_month")}
          className={`toolbar-btn ${timeScope === "this_month" ? "toolbar-btn--accent" : ""}`}
          title="Only load ideas scheduled this month or unscheduled and active"
        >
          This month
        </button>
        <button
          onClick={() => onTimeScopeChange("all")}
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
            onClick={onToggleCardMode}
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
          onClick={() => onViewModeChange("tree")}
          className={`toolbar-btn ${viewMode === "tree" ? "toolbar-btn--accent" : ""}`}
        >
          Tree
        </button>
        <button
          onClick={() => onViewModeChange("graph")}
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
}

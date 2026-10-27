"use client";

import { ArrowLeft, Check, FileText, ListTree, Pencil, X } from "lucide-react";
import { BrainstormBreadcrumb } from "@/components/brainstorm/BrainstormBreadcrumb";
import { ProjectFiltersMenu } from "@/components/projects/ProjectFiltersMenu";
import type { Idea } from "@/lib/types";
import type { ProjectViewMode } from "@/stores/uiPrefsStore";

interface ProjectDetailHeaderProps {
  project: Idea;
  focusedIdea: Idea;
  breadcrumbChain: Idea[];
  focusedId: string | null;
  effectiveMode: ProjectViewMode;
  isNarrow: boolean;
  detailHideClosed: boolean;
  detailHideCompleted: boolean;
  unpathedCount: number;
  unpathedOnly: boolean;
  titleEditing: boolean;
  titleDraft: string;
  directCount: number;
  doneCount: number;
  totalCount: number;
  nextText: string | null;
  onBack: () => void;
  onToggleHideClosed: () => void;
  onToggleHideCompleted: () => void;
  onToggleUnpathedOnly: () => void;
  onViewModeChange: (mode: ProjectViewMode) => void;
  onOpenDetails: () => void;
  onSelectBreadcrumb: (id: string | null) => void;
  onTitleDraftChange: (v: string) => void;
  onCommitTitleRename: () => void;
  onCancelTitleEdit: () => void;
  onStartTitleEdit: () => void;
  onBackToRoot: () => void;
}

export function ProjectDetailStartActions({
  detailHideClosed,
  detailHideCompleted,
  effectiveMode,
  unpathedCount,
  unpathedOnly,
  onBack,
  onToggleHideClosed,
  onToggleHideCompleted,
  onToggleUnpathedOnly,
}: Pick<
  ProjectDetailHeaderProps,
  | "detailHideClosed"
  | "detailHideCompleted"
  | "effectiveMode"
  | "unpathedCount"
  | "unpathedOnly"
  | "onBack"
  | "onToggleHideClosed"
  | "onToggleHideCompleted"
  | "onToggleUnpathedOnly"
>) {
  return (
    <>
      <button onClick={onBack} className="toolbar-btn flex items-center gap-1.5">
        <ArrowLeft size={14} /> Back
      </button>
      <ProjectFiltersMenu
        hideClosed={detailHideClosed}
        onToggleHideClosed={onToggleHideClosed}
        hideCompleted={detailHideCompleted}
        onToggleHideCompleted={onToggleHideCompleted}
      />
      {effectiveMode !== "paths" && unpathedCount > 0 && (
        <button
          type="button"
          onClick={onToggleUnpathedOnly}
          aria-pressed={unpathedOnly}
          title="Show only tasks that belong to no path"
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            unpathedOnly
              ? "border-indigo-300 bg-white text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
              : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
          }`}
        >
          Tasks not in a path ({unpathedCount})
        </button>
      )}
    </>
  );
}

export function ProjectDetailActions({
  project,
  effectiveMode,
  isNarrow,
  onViewModeChange,
  onOpenDetails,
}: Pick<
  ProjectDetailHeaderProps,
  "project" | "effectiveMode" | "isNarrow" | "onViewModeChange" | "onOpenDetails"
>) {
  const hasNotes = !!project.notes?.trim();
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex rounded-xl border border-gray-200 p-0.5 dark:border-gray-700"
        role="group"
        aria-label="Project view"
      >
        <button
          onClick={() => onViewModeChange("list")}
          aria-pressed={effectiveMode === "list"}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${effectiveMode === "list" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" : "text-gray-500"}`}
        >
          List
        </button>
        {!isNarrow && (
          <button
            onClick={() => onViewModeChange("split")}
            aria-pressed={effectiveMode === "split"}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${effectiveMode === "split" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" : "text-gray-500"}`}
          >
            Split
          </button>
        )}
        <button
          onClick={() => onViewModeChange("paths")}
          aria-pressed={effectiveMode === "paths"}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${effectiveMode === "paths" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" : "text-gray-500"}`}
        >
          Paths
        </button>
      </div>
      <button
        onClick={onOpenDetails}
        className="toolbar-btn flex items-center gap-1.5"
        title={hasNotes ? "Edit project details" : "Add project details"}
        aria-label={hasNotes ? "Edit project details" : "Add project details"}
      >
        <FileText
          size={14}
          strokeWidth={hasNotes ? 2 : 1.5}
          className={hasNotes ? "text-indigo-500" : ""}
        />
        Details
        {hasNotes ? <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden /> : null}
      </button>
    </div>
  );
}

export function ProjectDetailTop({
  project,
  focusedIdea,
  breadcrumbChain,
  focusedId,
  titleEditing,
  titleDraft,
  directCount,
  doneCount,
  totalCount,
  nextText,
  onSelectBreadcrumb,
  onTitleDraftChange,
  onCommitTitleRename,
  onCancelTitleEdit,
  onStartTitleEdit,
  onBackToRoot,
}: Pick<
  ProjectDetailHeaderProps,
  | "project"
  | "focusedIdea"
  | "breadcrumbChain"
  | "focusedId"
  | "titleEditing"
  | "titleDraft"
  | "directCount"
  | "doneCount"
  | "totalCount"
  | "nextText"
  | "onSelectBreadcrumb"
  | "onTitleDraftChange"
  | "onCommitTitleRename"
  | "onCancelTitleEdit"
  | "onStartTitleEdit"
  | "onBackToRoot"
>) {
  return (
    <>
      {breadcrumbChain.length > 0 && (
        <div className="mb-3">
          <BrainstormBreadcrumb
            chain={breadcrumbChain}
            focused={focusedIdea}
            onSelect={onSelectBreadcrumb}
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
              onChange={(e) => onTitleDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onCommitTitleRename();
                if (e.key === "Escape") onCancelTitleEdit();
              }}
              onBlur={() => void onCommitTitleRename()}
              aria-label="Rename project"
              className="min-w-0 flex-1 rounded-lg border border-violet-300 bg-white px-2 py-1 text-lg font-bold focus:ring-2 focus:ring-violet-500/30 focus:outline-none dark:border-violet-700 dark:bg-gray-800"
            />
            <button
              onClick={() => void onCommitTitleRename()}
              aria-label="Save project name"
              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
            >
              <Check size={15} />
            </button>
            <button
              onClick={onCancelTitleEdit}
              aria-label="Cancel rename"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5"
            >
              <X size={15} />
            </button>
          </span>
        ) : (
          <>
            <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-gray-900 dark:text-gray-100">
              {project.text || "Untitled project"}
            </h2>
            <button
              onClick={onStartTitleEdit}
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
        <span className="capitalize">{project.status.replace("_", " ")}</span>
        <span>·</span>
        <span>{directCount} direct tasks</span>
        <span>·</span>
        <span>
          {doneCount}/{totalCount} complete
        </span>
        {nextText && (
          <>
            <span>·</span>
            <span className="truncate font-semibold text-violet-600">Next: {nextText}</span>
          </>
        )}
        {focusedId && (
          <button onClick={onBackToRoot} className="toolbar-btn flex items-center gap-1">
            <ListTree size={12} /> Back to project root
          </button>
        )}
      </div>
    </>
  );
}

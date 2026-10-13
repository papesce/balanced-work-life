"use client";

import type { ReactNode } from "react";
import { ChevronUp, FolderKanban, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ColumnShell, groupKeyOf, type LensColumn } from "@/components/lens";
import { ValueHelpInfo } from "@/components/shared/ValueHelpInfo";
import { UndoBar } from "@/components/shared/UndoBar";
import type { UndoAction } from "@/lib/tasks/undo";
import type { Idea } from "@/lib/types";

export interface ProjectLensTab {
  key: string;
  label: string;
}

interface ProjectListViewProps {
  columns: LensColumn[];
  groupedProjects: Map<string | null, Idea[]>;
  visibleCount: number;
  lensKey: string;
  lensTabs: ProjectLensTab[];
  statusFilter: "all" | "open";
  hideCompleted: boolean;
  unclassifiedExpanded: boolean;
  undoAction: UndoAction | null;
  renderCard: (p: Idea) => ReactNode;
  onLensChange: (key: string) => void;
  onStatusFilterChange: (v: "all" | "open") => void;
  onToggleHideCompleted: () => void;
  onToggleUnclassifiedExpanded: (expanded: boolean) => void;
  onAddProject: () => void;
  onAddProjectInGroup: (value: string | null) => void;
  onUndo: () => void;
  onDismissUndo: () => void;
}

function ProjectListColumn({
  value,
  label,
  list,
  lensKey,
  schemeLabel,
  columns,
  unclassifiedExpanded,
  onToggleUnclassifiedExpanded,
  onAddProjectInGroup,
  renderCard,
}: {
  value: string | null;
  label: string;
  list: Idea[];
  lensKey: string;
  schemeLabel: string;
  columns: LensColumn[];
  unclassifiedExpanded: boolean;
  onToggleUnclassifiedExpanded: (expanded: boolean) => void;
  onAddProjectInGroup: (value: string | null) => void;
  renderCard: (p: Idea) => ReactNode;
}) {
  const isUnclassified = value === null;
  if (isUnclassified && !unclassifiedExpanded) {
    return (
      <div key="unclassified-collapsed" className="glass-card rounded-2xl">
        <div className="flex w-full items-center justify-between gap-2 px-4 py-3">
          <button
            onClick={() => onToggleUnclassifiedExpanded(true)}
            className="flex flex-1 items-center justify-between text-sm font-semibold text-gray-500"
          >
            <span>Unclassified · {list.length} for triage</span>
            <ChevronUp size={14} className="rotate-180" />
          </button>
          <ValueHelpInfo
            lensKey={lensKey}
            schemeLabel={schemeLabel}
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
      onClick={() => onToggleUnclassifiedExpanded(false)}
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
          schemeLabel={schemeLabel}
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
          list.map(renderCard)
        )}
        <button
          onClick={() => void onAddProjectInGroup(value)}
          className="w-full rounded-xl border border-dashed border-black/10 px-3 py-2 text-xs font-semibold text-gray-400 transition hover:border-violet-300 hover:text-violet-600 dark:border-white/10"
        >
          + Add to {label}
        </button>
      </div>
    </ColumnShell>
  );
}

export function ProjectListView({
  columns,
  groupedProjects,
  visibleCount,
  lensKey,
  lensTabs,
  statusFilter,
  hideCompleted,
  unclassifiedExpanded,
  undoAction,
  renderCard,
  onLensChange,
  onStatusFilterChange,
  onToggleHideCompleted,
  onToggleUnclassifiedExpanded,
  onAddProject,
  onAddProjectInGroup,
  onUndo,
  onDismissUndo,
}: ProjectListViewProps) {
  const schemeLabel = lensTabs.find((t) => t.key === lensKey)?.label ?? "Group";
  return (
    <AppShell
      title="Projects"
      headerStartActions={
        <>
          <label
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 py-1.5 pr-2.5 pl-3 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
            title="Project grouping"
          >
            <span className="hidden sm:inline">By</span>
            <select
              value={lensKey}
              onChange={(e) => onLensChange(e.target.value)}
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
              onClick={() => onStatusFilterChange("open")}
              aria-pressed={statusFilter === "open"}
              className={`toolbar-btn ${statusFilter === "open" ? "toolbar-btn--accent" : ""}`}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => onStatusFilterChange("all")}
              aria-pressed={statusFilter === "all"}
              className={`toolbar-btn ${statusFilter === "all" ? "toolbar-btn--accent" : ""}`}
            >
              All
            </button>
          </div>
          <button
            type="button"
            onClick={onToggleHideCompleted}
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
      }
      headerActions={
        <button
          onClick={onAddProject}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
        >
          <Plus size={13} /> New project
        </button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-xs text-gray-400">
          {visibleCount} project{visibleCount !== 1 ? "s" : ""}
        </p>

        {visibleCount === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <FolderKanban size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">No projects found</p>
            <p className="mt-1 text-xs">
              Create a project in Brainstorm with type &quot;project&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {columns.map((col) => (
              <ProjectListColumn
                key={groupKeyOf(col.key)}
                value={col.key}
                label={col.label}
                list={groupedProjects.get(col.key) ?? []}
                lensKey={lensKey}
                schemeLabel={schemeLabel}
                columns={columns}
                unclassifiedExpanded={unclassifiedExpanded}
                onToggleUnclassifiedExpanded={onToggleUnclassifiedExpanded}
                onAddProjectInGroup={onAddProjectInGroup}
                renderCard={renderCard}
              />
            ))}
            {lensKey === "area" && (
              <ProjectListColumn
                value={null}
                label="Unclassified"
                list={groupedProjects.get(null) ?? []}
                lensKey={lensKey}
                schemeLabel={schemeLabel}
                columns={columns}
                unclassifiedExpanded={unclassifiedExpanded}
                onToggleUnclassifiedExpanded={onToggleUnclassifiedExpanded}
                onAddProjectInGroup={onAddProjectInGroup}
                renderCard={renderCard}
              />
            )}
          </div>
        )}

        <UndoBar undoAction={undoAction} onUndo={onUndo} onDismiss={onDismissUndo} />
      </div>
    </AppShell>
  );
}

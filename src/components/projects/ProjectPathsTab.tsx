"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronUp, Ellipsis, Network, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusPill } from "@/components/shared/StatusPill";
import { PathEditor } from "@/components/paths/PathEditor";
import { useAllPathStepSummaries } from "@/hooks/usePathStepSummary";
import { formatPathProgress, type PathCanvasApi } from "@/lib/projectPaths";
import {
  getPathStatusPresentation,
  normalizePathStatus,
  PATH_STATUS_OPTIONS,
} from "@/lib/projectPathStatus";
import type { Path } from "@/lib/paths";
import type { Idea } from "@/lib/types";

interface PathManagementProps {
  projectId: string;
  paths: Path[];
  selectedPathId: string | null;
  onSelectPath: (pathId: string) => void;
  onCreatePath: () => Promise<void>;
  onRenamePath: (pathId: string, title: string) => Promise<void>;
  onUpdatePathStatus: (pathId: string, status: string) => Promise<void>;
  onDeletePath: (pathId: string) => Promise<void>;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function ProjectPathsTab({
  projectId,
  paths,
  selectedPathId,
  onSelectPath,
  onCreatePath,
  onRenamePath,
  onUpdatePathStatus,
  onDeletePath,
  collapsed = false,
  onToggleCollapsed,
}: PathManagementProps) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [editingPathId, setEditingPathId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Path | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const cancelRenameRef = useRef(false);
  const summaries = useAllPathStepSummaries();
  const visiblePaths = useMemo(
    () =>
      paths.filter(
        (path) => statusFilter === "all" || normalizePathStatus(path.status) === statusFilter,
      ),
    [paths, statusFilter],
  );
  const focusPathId = visiblePaths.some((path) => path.id === selectedPathId)
    ? selectedPathId
    : (visiblePaths[0]?.id ?? null);

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update paths.");
    } finally {
      setBusy(false);
    }
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (
      event.key === "F2" ||
      (event.key === "Enter" && visiblePaths[index]?.id === selectedPathId)
    ) {
      event.preventDefault();
      cancelRenameRef.current = false;
      setEditingPathId(visiblePaths[index]?.id ?? null);
      return;
    }
    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(index + 1, visiblePaths.length - 1)
        : event.key === "ArrowUp"
          ? Math.max(index - 1, 0)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? visiblePaths.length - 1
              : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextPath = visiblePaths[nextIndex];
    if (!nextPath) return;
    onSelectPath(nextPath.id);
    rowRefs.current.get(nextPath.id)?.focus();
  };

  return (
    <section aria-labelledby={`paths-heading-${projectId}`} className="min-w-0">
      <div className="flex min-h-8 items-center gap-2">
        <h3
          id={`paths-heading-${projectId}`}
          className="text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400"
        >
          Paths
        </h3>
        <label className="sr-only" htmlFor={`paths-filter-${projectId}`}>
          Filter paths by status
        </label>
        <select
          id={`paths-filter-${projectId}`}
          aria-label="Filter paths by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="min-w-0 rounded-lg border border-gray-200 bg-white px-1.5 py-1 text-[11px] text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          <option value="all">All statuses</option>
          {PATH_STATUS_OPTIONS.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void runAction(onCreatePath)}
          disabled={busy}
          aria-label="Create path"
          title="Create path"
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Plus size={15} />
        </button>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand paths section" : "Collapse paths section"}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-white/5"
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="mt-1">
          {visiblePaths.length === 0 ? (
            <div className="flex min-h-9 items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{paths.length === 0 ? "No paths yet" : "No paths match this status"}</span>
              <button
                type="button"
                onClick={() => void runAction(onCreatePath)}
                disabled={busy}
                className="font-semibold text-violet-600 hover:underline focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-50 dark:text-violet-300"
              >
                New path
              </button>
            </div>
          ) : (
            <ul aria-label="Project paths" className="space-y-0.5">
              {visiblePaths.map((path, index) => {
                const summary = summaries.get(path.id) ?? {
                  completedSteps: 0,
                  totalSteps: 0,
                };
                const selected = path.id === selectedPathId;
                const status = getPathStatusPresentation(path.status);
                return (
                  <li key={path.id} className="relative">
                    <div
                      className={`group relative flex min-w-0 items-center gap-1 rounded-md px-1 py-1 transition-colors ${
                        selected
                          ? "bg-indigo-100/70 dark:bg-indigo-500/15"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      {selected && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-violet-500"
                        />
                      )}
                      <Network
                        size={14}
                        aria-hidden="true"
                        className="ml-1 shrink-0 text-violet-500 dark:text-violet-300"
                      />
                      {editingPathId === path.id ? (
                        <input
                          autoFocus
                          defaultValue={path.title}
                          aria-label={`Rename ${path.title || "Untitled path"}`}
                          onBlur={(event) => {
                            if (cancelRenameRef.current) {
                              cancelRenameRef.current = false;
                              setEditingPathId(null);
                              return;
                            }
                            setEditingPathId(null);
                            const title = event.currentTarget.value.trim();
                            if (title && title !== path.title) {
                              void runAction(() => onRenamePath(path.id, title));
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                            if (event.key === "Escape") {
                              cancelRenameRef.current = true;
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                          }}
                          className="min-h-9 min-w-0 flex-1 rounded-md border border-violet-400 bg-white px-2 text-sm text-gray-800 focus-visible:outline-2 focus-visible:outline-violet-500 max-sm:min-h-11 dark:bg-gray-900 dark:text-gray-100"
                        />
                      ) : (
                        <button
                          ref={(element) => {
                            if (element) rowRefs.current.set(path.id, element);
                            else rowRefs.current.delete(path.id);
                          }}
                          type="button"
                          aria-current={selected ? "true" : undefined}
                          aria-label={`${path.title || "Untitled path"}, ${status.label.toLowerCase()}, ${formatPathProgress(summary.completedSteps, summary.totalSteps)} steps complete`}
                          title={path.title || "Untitled path"}
                          tabIndex={path.id === focusPathId ? 0 : -1}
                          onClick={() => onSelectPath(path.id)}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            cancelRenameRef.current = false;
                            setEditingPathId(path.id);
                          }}
                          onKeyDown={(event) => handleRowKeyDown(event, index)}
                          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm text-gray-700 focus-visible:outline-2 focus-visible:outline-violet-500 max-sm:min-h-11 dark:text-gray-200"
                        >
                          <span className="min-w-0 flex-1 truncate rounded px-1 py-0.5 group-hover:bg-gray-100 dark:group-hover:bg-white/[0.04]">
                            {path.title || "Untitled path"}
                          </span>
                        </button>
                      )}
                      {editingPathId !== path.id && (
                        <>
                          <StatusPill
                            id={`path-status-${path.id}`}
                            ariaLabel={`Status: ${status.label.toLowerCase()}. Change status`}
                            className={status.className}
                            ariaHasPopup="menu"
                            ariaExpanded={openStatusId === path.id}
                            onClick={() => {
                              setOpenMenuId(null);
                              setOpenStatusId((current) => (current === path.id ? null : path.id));
                            }}
                          >
                            {status.label}
                          </StatusPill>
                          <span
                            className="shrink-0 text-[10px] text-gray-500 tabular-nums dark:text-gray-400"
                            aria-label={`${summary.completedSteps} of ${summary.totalSteps} steps complete`}
                          >
                            {formatPathProgress(summary.completedSteps, summary.totalSteps)}
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        aria-label={`Actions for ${path.title || "Untitled path"}`}
                        aria-haspopup="true"
                        aria-controls={`path-actions-${path.id}`}
                        aria-expanded={openMenuId === path.id}
                        onClick={() =>
                          setOpenMenuId((current) => (current === path.id ? null : path.id))
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      >
                        <Ellipsis size={15} />
                      </button>
                    </div>
                    {openStatusId === path.id && (
                      <div
                        role="menu"
                        aria-labelledby={`path-status-${path.id}`}
                        className="absolute top-full left-8 z-30 mt-1 flex w-36 flex-col gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900"
                      >
                        {PATH_STATUS_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={normalizePathStatus(path.status) === option.value}
                            onClick={() => {
                              setOpenStatusId(null);
                              void runAction(() => onUpdatePathStatus(path.id, option.value));
                            }}
                            className="min-h-9 rounded px-2 text-left text-xs hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-violet-500 max-sm:min-h-11 dark:hover:bg-gray-800"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {openMenuId === path.id && (
                      <div
                        id={`path-actions-${path.id}`}
                        className="absolute top-full right-0 z-20 mt-1 flex w-48 flex-col gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onSelectPath(path.id);
                            cancelRenameRef.current = false;
                            setEditingPathId(path.id);
                          }}
                          className="rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-gray-800"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            setOpenStatusId(path.id);
                          }}
                          className="rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-gray-800"
                        >
                          Change status
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            setDeleteTarget(path);
                          }}
                          className="rounded px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-500 dark:text-rose-400 dark:hover:bg-rose-950/30"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete “${deleteTarget?.title || "Untitled path"}”?`}
        body="This removes the path and its steps. Linked tasks are not deleted."
        confirmLabel="Delete path"
        cancelLabel="Cancel"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const pathId = deleteTarget.id;
          setDeleteTarget(null);
          void runAction(() => onDeletePath(pathId));
        }}
      />
    </section>
  );
}

interface ProjectPathCanvasProps {
  pathId: string | null;
  projectId: string;
  tasks: Idea[];
  fillHeight?: boolean;
  isNarrow?: boolean;
  onCanvasApi?: (api: PathCanvasApi | null) => void;
}

export function ProjectPathCanvas({
  pathId,
  projectId,
  tasks,
  fillHeight = false,
  isNarrow = false,
  onCanvasApi,
}: ProjectPathCanvasProps) {
  if (!pathId) {
    return (
      <div
        className={`flex min-h-0 items-center justify-center text-sm text-gray-500 dark:text-gray-400 ${
          fillHeight ? "h-full" : "min-h-64"
        }`}
      >
        Select or create a path to start planning.
      </div>
    );
  }
  return (
    <PathEditor
      pathId={pathId}
      fillHeight={fillHeight}
      projectId={projectId}
      projectTasks={tasks.filter((task) => task.type === "task")}
      isNarrow={isNarrow}
      onCanvasApi={onCanvasApi}
      mode="edit"
    />
  );
}

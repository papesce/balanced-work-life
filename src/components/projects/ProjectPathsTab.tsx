"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useQuery } from "@powersync/react";
import { useAuth } from "@/hooks/useAuth";
import { usePaths } from "@/hooks/usePaths";
import { usePathItems } from "@/hooks/usePathItems";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import { deserializePathItem } from "@/lib/paths";
import { ProjectWorkflowCanvas } from "./ProjectWorkflowView";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { Idea, IdeaLink, Tag } from "@/lib/types";

interface Props {
  projectId: string;
  tasks: Idea[];
  links: IdeaLink[];
  tagsForTask: (id: string) => Tag[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => Promise<void>;
  onOpenNotes: (id: string) => void;
  onCreateLink: (sourceId: string, targetId: string, type: "depends_on") => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onAddStep: () => Promise<string | null>;
  /** False in split mode: the List pane replaces the "Project tasks" strip. */
  showTray?: boolean;
  /** Fill the parent pane height instead of the fixed 600px canvas. */
  fillHeight?: boolean;
  /** Bump to re-fit the canvas viewport after the host pane resizes. */
  fitTick?: number;
  /** Reports the selected path + add entry point so the List pane can add steps. */
  onCanvasApi?: (api: PathCanvasApi | null) => void;
}

/** Minimal canvas entry point consumed by the List pane (split mode). */
export interface PathCanvasApi {
  selectedPathId: string | null;
  placedIds: Set<string>;
  /** Adds a task to the selected path; false when there is no selected path. */
  addToPath: (ideaId: string) => Promise<boolean>;
}

export function ProjectPathsTab({
  projectId,
  tasks,
  links,
  tagsForTask,
  onUpdateTask,
  onOpenNotes,
  onCreateLink,
  onDeleteLink,
  onAddStep,
  showTray = true,
  fillHeight = false,
  fitTick = 0,
  onCanvasApi,
}: Props) {
  const { user } = useAuth();
  const { paths, loading, createPath, renamePath, deletePath } = usePaths(projectId);
  const projectLastPath = useUiPrefsStore((s) => s.projectLastPath);
  const hideCompleted = useUiPrefsStore((s) => s.projectsDetailHideCompleted);
  const setPrefs = useUiPrefsStore((s) => s.set);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Restore last-selected path per project; fall back to the first path.
  useEffect(() => {
    if (loading || paths.length === 0) return;
    const remembered = projectLastPath[projectId];
    if (remembered && paths.some((p) => p.id === remembered)) {
      if (remembered !== selectedId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedId(remembered);
      }
      return;
    }
    if (!selectedId || !paths.some((p) => p.id === selectedId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(paths[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, paths, projectId]);

  const selectPath = useCallback(
    (id: string) => {
      setSelectedId(id);
      setRenamingId(null);
      setPrefs({ projectLastPath: { ...projectLastPath, [projectId]: id } });
    },
    [projectLastPath, projectId, setPrefs],
  );

  const selectedPath = paths.find((p) => p.id === selectedId) ?? null;
  const itemsHook = usePathItems(selectedId ?? "");

  // Canvas API for the List pane: which tasks are already placed + how to
  // add one without drop coordinates (grid fallback, user can rearrange).
  // NOTE: itemsHook returns a fresh object every render, so nothing derived
  // from it is referentially stable. Propagate the api only when its content
  // (selected path / placed ids) actually changes — otherwise the parent
  // setState would loop forever (max update depth).
  const placedIds = useMemo(
    () => new Set(itemsHook.items.map((n) => n.idea_id)),
    [itemsHook.items],
  );
  const placedKey = useMemo(() => [...placedIds].sort().join(","), [placedIds]);
  const lastReportedKey = useRef<string | null>(null);
  useEffect(() => {
    const key = `${selectedId ?? ""}|${placedKey}`;
    if (lastReportedKey.current === key) return;
    lastReportedKey.current = key;
    const api: PathCanvasApi = {
      selectedPathId: selectedId,
      placedIds,
      addToPath: async (ideaId: string) => {
        if (!selectedId) return false;
        const n = itemsHook.items.length;
        await itemsHook.addItem(ideaId, 80 + (n % 3) * 260, 70 + Math.floor(n / 3) * 160);
        return true;
      },
    };
    onCanvasApi?.(api);
  });
  useEffect(() => {
    // Clear the List pane's entry point when this tab unmounts.
    return () => {
      lastReportedKey.current = null;
      onCanvasApi?.(null);
    };
  }, [onCanvasApi]);

  // All items across this project's paths (for the shared-dependency notice).
  const userId = user?.id ?? "";
  const { data: allItemRows } = useQuery<Record<string, unknown>>(
    userId && projectId
      ? `SELECT pi.* FROM path_items pi JOIN paths p ON p.id = pi.path_id WHERE p.project_id = ? AND p.user_id = ?`
      : "SELECT * FROM path_items WHERE 0",
    userId && projectId ? [projectId, userId] : [],
  );
  const pairsInOtherPaths = useMemo(() => {
    const pairs = new Set<string>();
    const byPath = new Map<string, Set<string>>();
    for (const row of allItemRows.map(deserializePathItem)) {
      const set = byPath.get(row.path_id) ?? new Set<string>();
      set.add(row.idea_id);
      byPath.set(row.path_id, set);
    }
    // For each other path, record every unordered pair it contains.
    const otherSets: Set<string>[] = [];
    for (const [pid, set] of byPath) {
      if (pid !== selectedId) otherSets.push(set);
    }
    for (const set of otherSets) {
      const ids = [...set];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const [a, b] = [ids[i], ids[j]].sort();
          pairs.add(`${a}|${b}`);
        }
      }
    }
    return pairs;
  }, [allItemRows, selectedId]);

  const isPairInAnotherPath = useCallback(
    (a: string, b: string) => {
      const [x, y] = [a, b].sort();
      return pairsInOtherPaths.has(`${x}|${y}`);
    },
    [pairsInOtherPaths],
  );

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const id = await createPath();
      if (id) {
        selectPath(id);
        setRenamingId(id);
        setRenameDraft("");
      }
    } finally {
      setCreating(false);
    }
  }, [createPath, selectPath]);

  const commitRename = useCallback(
    async (id: string) => {
      const title = renameDraft.trim();
      if (title) await renamePath(id, title);
      setRenamingId(null);
    },
    [renameDraft, renamePath],
  );

  const confirmDelete = useCallback(async () => {
    if (!deletingId) return;
    await deletePath(deletingId);
    if (selectedId === deletingId) {
      const remaining = paths.filter((p) => p.id !== deletingId);
      const next = remaining[0]?.id ?? null;
      setSelectedId(next);
      if (next) setPrefs({ projectLastPath: { ...projectLastPath, [projectId]: next } });
    }
    setDeletingId(null);
  }, [deletingId, deletePath, selectedId, paths, projectId, projectLastPath, setPrefs]);

  if (loading) {
    return <div className="flex animate-pulse justify-center py-20 text-gray-400">Loading…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {paths.map((p) => (
          <span key={p.id} className="flex items-center">
            {renamingId === p.id ? (
              <span className="flex items-center gap-1 rounded-xl border border-violet-300 px-2 py-1 dark:border-violet-700">
                <input
                  autoFocus
                  value={renameDraft}
                  placeholder={p.title || "Untitled path"}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void commitRename(p.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onBlur={() => void commitRename(p.id)}
                  aria-label="Rename path"
                  className="w-32 bg-transparent text-xs font-semibold outline-none"
                />
                <button
                  onClick={() => void commitRename(p.id)}
                  aria-label="Save path name"
                  className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50"
                >
                  <Check size={13} />
                </button>
                <button
                  onClick={() => setRenamingId(null)}
                  aria-label="Cancel rename"
                  className="rounded p-0.5 text-gray-400 hover:bg-black/5"
                >
                  <X size={13} />
                </button>
              </span>
            ) : (
              <button
                onClick={() => selectPath(p.id)}
                aria-pressed={selectedId === p.id}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  selectedId === p.id
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {p.title || "Untitled path"}
              </button>
            )}
            {selectedId === p.id && renamingId !== p.id && (
              <span className="flex items-center">
                <button
                  onClick={() => {
                    setRenamingId(p.id);
                    setRenameDraft(p.title);
                  }}
                  title="Rename path"
                  aria-label="Rename path"
                  className="rounded p-1 text-gray-400 hover:text-violet-600"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => setDeletingId(p.id)}
                  title="Delete path"
                  aria-label="Delete path"
                  className="rounded p-1 text-gray-400 hover:text-rose-600"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            )}
          </span>
        ))}
        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          className="flex items-center gap-1 rounded-xl border border-dashed border-black/10 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:border-violet-300 hover:text-violet-600 disabled:opacity-50 dark:border-white/10"
        >
          <Plus size={12} /> {creating ? "Creating…" : "New path"}
        </button>
      </div>

      {!selectedPath ? (
        <div className="rounded-xl border border-gray-200 px-4 py-12 text-center dark:border-gray-700">
          <p className="text-sm font-semibold">No paths yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Create a path to arrange a subset of this project&apos;s tasks in execution order.
          </p>
        </div>
      ) : (
        <ProjectWorkflowCanvas
          tasks={tasks}
          links={links}
          items={itemsHook.items}
          onAddItem={(ideaId, x, y) => itemsHook.addItem(ideaId, x, y)}
          onRemoveItem={(ideaId) => itemsHook.removeItem(ideaId)}
          onMoveItems={(positions) => itemsHook.moveItems(positions)}
          tagsForTask={tagsForTask}
          onUpdateTask={onUpdateTask}
          onOpenNotes={onOpenNotes}
          onCreateLink={onCreateLink}
          onDeleteLink={onDeleteLink}
          onAddStep={onAddStep}
          isPairInAnotherPath={isPairInAnotherPath}
          hideCompleted={hideCompleted}
          showTray={showTray}
          fillHeight={fillHeight}
          fitTick={fitTick}
        />
      )}

      <ConfirmDialog
        open={deletingId !== null}
        title="Delete this path?"
        body="Tasks and dependencies are kept — only the path layout is removed."
        confirmLabel="Delete path"
        cancelLabel="Cancel"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}

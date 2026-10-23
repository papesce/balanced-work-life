"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { usePowerSync, useQuery } from "@powersync/react";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "@/hooks/useAuth";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import { deserializePath } from "@/lib/paths";
import { PathView, PathCanvasProvider } from "./PathView";
import type { Idea, IdeaLink, LinkType, Tag } from "@/lib/types";

interface Props {
  projectId: string;
  tasks: Idea[];
  links: IdeaLink[];
  tagsForTask: (id: string) => Tag[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => Promise<void>;
  onOpenNotes: (id: string) => void;
  onCreateLink: (sourceId: string, targetId: string, type: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  fillHeight?: boolean;
  fitTick?: number;
  onCanvasApi?: (api: PathCanvasApi | null) => void;
  hideClosed?: boolean;
}

export interface PathCanvasApi {
  selectedPathId: string | null;
  placedIds: Set<string>;
  addToPath: (ideaId: string) => Promise<boolean>;
}

export function ProjectPathsTab({ projectId, tasks, fillHeight = false, onCanvasApi }: Props) {
  const { user } = useAuth();
  const db = usePowerSync();
  const userId = user?.id ?? "";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const projectLastPath = useUiPrefsStore((s) => s.projectLastPath);
  const setPrefs = useUiPrefsStore((s) => s.set);
  const { data: rawPaths } = useQuery<Record<string, unknown>>(
    userId
      ? "SELECT i.*, l.target_id AS project_id FROM ideas i JOIN idea_links l ON l.source_id = i.id WHERE i.user_id = ? AND i.type = 'path' AND l.target_id = ? AND l.link_type = 'path_of' ORDER BY i.sort_order, i.created_at"
      : "SELECT * FROM ideas WHERE 0",
    userId ? [userId, projectId] : [],
  );
  const paths = useMemo(() => rawPaths.map(deserializePath), [rawPaths]);
  const visiblePaths = useMemo(
    () =>
      paths.filter(
        (path) =>
          statusFilter === "all" ||
          (statusFilter === "open" ? path.status === "draft" : path.status === statusFilter),
      ),
    [paths, statusFilter],
  );

  const remembered = projectLastPath[projectId];
  const activeSelectedId = paths.some((p) => p.id === selectedId)
    ? selectedId
    : paths.some((p) => p.id === remembered)
      ? remembered
      : (paths[0]?.id ?? null);
  const activePathId = visiblePaths.some((path) => path.id === activeSelectedId)
    ? activeSelectedId
    : (visiblePaths[0]?.id ?? null);

  const selectPath = useCallback(
    (id: string) => {
      setSelectedId(id);
      setPrefs({ projectLastPath: { ...projectLastPath, [projectId]: id } });
    },
    [projectId, projectLastPath, setPrefs],
  );

  const createPath = async () => {
    if (!userId || creating) return;
    setCreating(true);
    const id = uuidv4();
    const now = new Date().toISOString();
    try {
      await db.execute(
        "INSERT INTO ideas (id, user_id, text, type, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        [id, userId, "Untitled path", "path", "draft", now, now],
      );
      await db.execute(
        "INSERT INTO idea_links (id, user_id, source_id, target_id, link_type, created_at) VALUES (?,?,?,?,?,?)",
        [uuidv4(), userId, id, projectId, "path_of", now],
      );
      selectPath(id);
    } finally {
      setCreating(false);
    }
  };

  const selectedPath = paths.find((p) => p.id === activePathId);
  const { data: items } = useQuery<Record<string, unknown>>(
    userId && activePathId
      ? "SELECT * FROM path_items WHERE user_id = ? AND path_id = ?"
      : "SELECT * FROM path_items WHERE 0",
    userId && activePathId ? [userId, activePathId] : [],
  );
  const placedIds = useMemo(
    () => new Set(items.map((item) => String(item.idea_id ?? "")).filter(Boolean)),
    [items],
  );

  useEffect(() => {
    if (!activePathId) return;
    const api: PathCanvasApi = {
      selectedPathId: activePathId,
      placedIds,
      addToPath: async (ideaId) => {
        if (placedIds.has(ideaId)) return true;
        const itemId = uuidv4();
        const n = items.length;
        await db.execute(
          "INSERT INTO path_items (id, user_id, path_id, title, idea_id, x, y, created_at) VALUES (?,?,?,?,?,?,?,?)",
          [
            itemId,
            userId,
            activePathId,
            tasks.find((task) => task.id === ideaId)?.text ?? "",
            ideaId,
            100 + (n % 3) * 220,
            100 + Math.floor(n / 3) * 140,
            new Date().toISOString(),
          ],
        );
        return true;
      },
    };
    onCanvasApi?.(api);
    return () => onCanvasApi?.(null);
  }, [activePathId, placedIds, items, db, userId, tasks, onCanvasApi]);

  if (!userId) return null;
  return (
    <div className={fillHeight ? "flex h-full min-h-0 flex-col gap-3" : "space-y-3"}>
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          aria-label="Filter paths by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {visiblePaths.map((path) => (
          <button
            key={path.id}
            onClick={() => selectPath(path.id)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${activePathId === path.id ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" : "bg-black/[0.03] text-gray-500 dark:bg-white/[0.04]"}`}
          >
            {path.title || "Untitled path"}
          </button>
        ))}
        <button
          onClick={() => void createPath()}
          disabled={creating}
          className="flex items-center gap-1 rounded-xl border border-dashed border-black/10 px-3 py-1.5 text-xs font-semibold text-gray-500"
        >
          <Plus size={12} /> New path
        </button>
      </div>
      {!selectedPath ? (
        <div className="rounded-xl border border-gray-200 px-4 py-12 text-center text-sm text-gray-500 dark:border-gray-700">
          No paths associated with this project yet.
        </div>
      ) : (
        <PathCanvasProvider>
          <PathView pathId={selectedPath.id} fillHeight={fillHeight} />
        </PathCanvasProvider>
      )}
    </div>
  );
}

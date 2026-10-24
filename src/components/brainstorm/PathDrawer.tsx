"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ArrowDown, Search, X } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { usePathManager } from "@/hooks/usePathManager";

const LazyPathEditor = dynamic(
  () => import("@/components/paths/PathEditor").then((mod) => mod.PathEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
        Loading path editor...
      </div>
    ),
  },
);

interface TaskPickerProps {
  search: string;
  placedIds: Set<string>;
  addingId: string | null;
  onAddIdea: (ideaId: string) => Promise<boolean>;
}

export interface PathDrawerProps {
  pathId: string | null;
  onClose: () => void;
  renderTaskPicker: (props: TaskPickerProps) => ReactNode;
}

export function PathDrawer({ pathId, onClose, renderTaskPicker }: PathDrawerProps) {
  const [search, setSearch] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const manager = usePathManager(pathId ?? "");
  const placedIds = useMemo(
    () => new Set(manager.items.flatMap((item) => (item.idea_id ? [item.idea_id] : []))),
    [manager.items],
  );

  useEffect(() => {
    const updateViewport = () => setIsNarrow(window.innerWidth < 768);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!pathId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pathId, onClose]);

  const addIdea = async (ideaId: string) => {
    setAddingId(ideaId);
    setError(null);
    try {
      await manager.addExistingIdea(ideaId);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this idea to the path.");
      return false;
    } finally {
      setAddingId(null);
    }
  };

  if (!pathId) return null;

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <header className="flex min-h-11 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Path workspace</h2>
          <p className="text-xs text-gray-400">
            Add existing ideas from the tree, or drag them onto the canvas.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close path workspace"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <X size={17} />
        </button>
      </header>

      <Group
        orientation={isNarrow ? "vertical" : "horizontal"}
        className={`flex h-[calc(100dvh-245px)] w-full ${
          isNarrow ? "min-h-[780px]" : "min-h-[730px]"
        }`}
      >
        <Panel
          id="brainstorm-path-picker"
          defaultSize={isNarrow ? "38%" : "34%"}
          minSize={isNarrow ? "25%" : "22%"}
          className="min-h-0 min-w-0"
        >
          <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 p-3 dark:border-gray-800">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  Existing ideas
                </h3>
                <span className="text-[10px] text-gray-400">Search and add</span>
              </div>
              <label className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-gray-400 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-500/15 dark:border-gray-700 dark:bg-gray-800/70">
                <Search size={14} aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search brainstorm…"
                  aria-label="Search existing ideas"
                  className="min-w-0 flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
                />
              </label>
              {error && (
                <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                  {error}
                </p>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {renderTaskPicker({ search, placedIds, addingId, onAddIdea: addIdea })}
            </div>
            <div className="flex items-center gap-1.5 border-t border-gray-200 px-3 py-2 text-[10px] text-gray-400 dark:border-gray-800">
              <ArrowDown size={12} aria-hidden="true" />
              <span>Click the arrow to add, or drag a row onto the canvas.</span>
            </div>
          </section>
        </Panel>
        <Separator
          className={`mx-1 shrink-0 rounded-full bg-gray-200 transition-colors hover:bg-violet-300 focus-visible:bg-violet-400 focus-visible:outline-none dark:bg-gray-700 dark:hover:bg-violet-700 ${
            isNarrow ? "my-1 h-2 cursor-row-resize" : "w-2 cursor-col-resize"
          }`}
          aria-label="Resize idea picker and path canvas"
        />
        <Panel
          id="brainstorm-path-canvas"
          minSize={isNarrow ? "35%" : "30%"}
          className="min-h-0 min-w-0"
        >
          <div className="h-full min-h-0 overflow-hidden rounded-xl">
            <LazyPathEditor pathId={pathId} mode="edit" fillHeight />
          </div>
        </Panel>
      </Group>
    </section>
  );
}

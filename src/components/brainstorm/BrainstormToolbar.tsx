"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
} from "lucide-react";

export type BrainstormEditMode = "view" | "edit" | "insert";

export interface BrainstormToolbarProps {
  search: string;
  setSearch: (v: string) => void;
  editMode: BrainstormEditMode;
  setEditMode: (v: BrainstormEditMode) => void;
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
  onAddRoot: () => void;
  expandAll: () => void;
  collapseAll: () => void;
  cardMode?: boolean;
}

function pillClass(active: boolean) {
  return `rounded-full border px-2.5 py-1 text-xs ${
    active
      ? "border-indigo-300 bg-white font-medium text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
      : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
  }`;
}

export function BrainstormToolbar({
  search,
  setSearch,
  editMode,
  setEditMode,
  showType,
  setShowType,
  showArea,
  setShowArea,
  showToday,
  setShowToday,
  hideClosed,
  setHideClosed,
  hideCompleted,
  setHideCompleted,
  hideDeferred,
  setHideDeferred,
  onAddRoot,
  expandAll,
  collapseAll,
  cardMode,
}: BrainstormToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node))
        setFiltersOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (!overflowOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node))
        setOverflowOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverflowOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [overflowOpen]);

  const activeFilterCount =
    (showToday ? 1 : 0) +
    (hideClosed ? 1 : 0) +
    (hideCompleted ? 1 : 0) +
    (hideDeferred ? 1 : 0) +
    (!showType ? 1 : 0) +
    (!showArea ? 1 : 0);

  return (
    <>
      <button
        type="button"
        onClick={onAddRoot}
        className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
      >
        <Plus size={14} />
        <span className="hidden sm:inline">New</span>
      </button>

      <input
        type="text"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-32 rounded-lg border border-black/10 bg-white/60 px-3 py-1.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-indigo-500 sm:w-44 md:w-56 dark:border-white/10 dark:bg-gray-800/60 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-indigo-400"
      />

      <div role="radiogroup" aria-label="Editing mode" className="flex gap-1">
        <button
          type="button"
          role="radio"
          aria-checked={editMode === "view"}
          onClick={() => setEditMode("view")}
          title="Read-only: click a row to view its details"
          className={`toolbar-btn ${editMode === "view" ? "toolbar-btn--accent" : ""}`}
        >
          <Eye size={14} />
          <span className="hidden lg:inline">View</span>
        </button>
        {!cardMode && (
          <>
            <button
              type="button"
              role="radio"
              aria-checked={editMode === "edit"}
              onClick={() => setEditMode("edit")}
              title="Edit: click twice to rename, edit details inline"
              className={`toolbar-btn ${editMode === "edit" ? "toolbar-btn--accent" : ""}`}
            >
              <Pencil size={14} />
              <span className="hidden lg:inline">Edit</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={editMode === "insert"}
              onClick={() => setEditMode("insert")}
              title="Insert: hover a row to place a new idea above or below it"
              className={`toolbar-btn ${editMode === "insert" ? "toolbar-btn--accent" : ""}`}
            >
              <ListPlus size={14} />
              <span className="hidden lg:inline">Insert</span>
            </button>
          </>
        )}
      </div>

      <div ref={filtersRef} className="relative">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={filtersOpen}
          className="relative flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <SlidersHorizontal size={14} />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="glass-card-strong absolute top-full left-0 z-50 mt-1 min-w-[180px] rounded-xl border border-black/5 p-1.5 shadow-xl dark:border-white/5"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => setShowType(!showType)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-black/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.04]`}
              >
                <span>Type</span>
                <span className={pillClass(showType)}>On</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setShowArea(!showArea)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-black/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.04]`}
              >
                <span>Area</span>
                <span className={pillClass(showArea)}>On</span>
              </button>
              <div className="mx-1 my-1 border-t border-black/5 dark:border-white/5" />
              <button
                type="button"
                role="menuitem"
                onClick={() => setShowToday(!showToday)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-black/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.04]`}
              >
                <span>Today</span>
                <span className={pillClass(showToday)}>On</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setHideClosed(!hideClosed)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-black/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.04]`}
              >
                <span>Hide closed</span>
                <span className={pillClass(hideClosed)}>On</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setHideCompleted(!hideCompleted)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-black/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.04]`}
              >
                <span>Hide completed</span>
                <span className={pillClass(hideCompleted)}>On</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setHideDeferred(!hideDeferred)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-black/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.04]`}
              >
                <span>Hide deferred</span>
                <span className={pillClass(hideDeferred)}>On</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div ref={overflowRef} className="relative">
        <button
          type="button"
          onClick={() => setOverflowOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={overflowOpen}
          className="flex items-center justify-center rounded-md border border-gray-300 px-2 py-1.5 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <MoreHorizontal size={16} />
        </button>

        <AnimatePresence>
          {overflowOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="glass-card-strong absolute top-full right-0 z-50 mt-1 min-w-[160px] rounded-xl border border-black/5 p-1.5 shadow-xl dark:border-white/5"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  expandAll();
                  setOverflowOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-black/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.04]"
              >
                <ChevronDown size={14} />
                Expand all
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  collapseAll();
                  setOverflowOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-black/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.04]"
              >
                <ChevronUp size={14} />
                Collapse all
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

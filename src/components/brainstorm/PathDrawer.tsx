"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Lazy-load the heavy React Flow PathEditor so React Flow is NEVER in the initial Brainstorm bundle
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

export interface PathDrawerProps {
  pathId: string | null;
  onClose: () => void;
}

export function PathDrawer({ pathId, onClose }: PathDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!pathId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pathId, onClose]);

  if (!mounted || !pathId) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="relative z-10 flex h-full w-full max-w-4xl flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform dark:border-gray-800 dark:bg-gray-900">
        {/* Header bar */}
        <div className="flex h-12 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              Path Editor
            </span>
            <span className="text-xs text-gray-400">Autosaves continuously · Esc to close</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close path editor"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Editor Body */}
        <div className="relative flex-1 overflow-hidden p-3">
          <LazyPathEditor pathId={pathId} mode="edit" fillHeight />
        </div>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, StickyNote } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { NotesEditor } from "./NotesEditor";

export function NotesDrawer({ ideaId, onClose }: { ideaId: string | null; onClose: () => void }) {
  const { ideas, updateIdea } = useIdeas();
  const idea = ideaId ? (ideas.find((i) => i.id === ideaId) ?? null) : null;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!ideaId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [ideaId, onClose]);

  if (!mounted || !ideaId || !idea) return null;

  const handleSave = async (next: string | null) => {
    await updateIdea(ideaId, { notes: next });
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex h-full w-full max-w-[420px] flex-col bg-white shadow-xl sm:w-[420px] dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/5">
          <div className="flex items-center gap-2">
            <StickyNote size={16} className="text-indigo-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Notes</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close notes"
            className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p
            className="mb-2 truncate text-xs font-medium text-gray-500 dark:text-gray-400"
            title={idea.text}
          >
            {idea.text || "Untitled"}
          </p>
          <NotesEditor value={idea.notes} onSave={handleSave} />
          <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
            ⌘+Enter to save · Esc to close
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

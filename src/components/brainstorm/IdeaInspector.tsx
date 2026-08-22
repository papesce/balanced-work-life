"use client";

import { AlignLeft, StickyNote, X } from "lucide-react";
import { Idea } from "@/lib/types";
import { DetailField } from "./IdeaDetailField";

export type IdeaDetailUpdates = { description: string | null; notes: string | null };

export function IdeaInspector({
  idea,
  onUpdate,
  onClose,
  className = "",
}: {
  idea: Idea;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <aside className={className} onClick={(e) => e.stopPropagation()}>
      <div className="glass-card-strong rounded-xl p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-sm font-medium text-gray-800 dark:text-gray-100">
            {idea.text || <span className="text-gray-400 italic">Untitled</span>}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close details"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-black/[0.04] hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-300"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="space-y-2">
          <DetailField
            icon={AlignLeft}
            value={idea.description}
            placeholder="Add a short description…"
            onSave={(next) => onUpdate(idea.id, { description: next })}
          />
          <DetailField
            icon={StickyNote}
            value={idea.notes}
            placeholder="Add notes…"
            multiline
            onSave={(next) => onUpdate(idea.id, { notes: next })}
          />
        </div>
      </div>
    </aside>
  );
}

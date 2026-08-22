"use client";

import { ChevronRight, X } from "lucide-react";
import { Idea } from "@/lib/types";

interface BrainstormBreadcrumbProps {
  chain: Idea[];
  focused: Idea | null;
  onSelect: (id: string | null) => void;
}

export function BrainstormBreadcrumb({ chain, focused, onSelect }: BrainstormBreadcrumbProps) {
  if (!focused) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 overflow-x-auto text-xs whitespace-nowrap"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onSelect(null)}
        title="Show all ideas"
        className="rounded-md px-1.5 py-1 font-medium text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
      >
        All ideas
      </button>
      {chain.map((idea) => (
        <span key={idea.id} className="flex items-center gap-1">
          <ChevronRight size={12} className="shrink-0 text-gray-300 dark:text-gray-600" />
          <button
            type="button"
            onClick={() => onSelect(idea.id)}
            className="max-w-[160px] truncate rounded-md px-1.5 py-1 font-medium text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            title={idea.text || "Untitled"}
          >
            {idea.text || "Untitled"}
          </button>
        </span>
      ))}
      <span className="flex items-center gap-1">
        <ChevronRight size={12} className="shrink-0 text-gray-300 dark:text-gray-600" />
        <span
          aria-current="page"
          className="max-w-[200px] truncate rounded-md bg-indigo-50 px-1.5 py-1 font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
          title={focused.text || "Untitled"}
        >
          {focused.text || "Untitled"}
        </span>
      </span>
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-label="Exit focus"
        title="Exit focus"
        className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-black/[0.04] hover:text-gray-600 dark:text-gray-500 dark:hover:bg-white/[0.06] dark:hover:text-gray-300"
      >
        <X size={13} />
      </button>
    </nav>
  );
}

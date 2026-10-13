"use client";

import { Target } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { UndoBar } from "@/components/shared/UndoBar";
import { getChildCount } from "@/lib/ideaTreeFocus";
import type { UndoAction } from "@/lib/tasks/undo";
import type { Idea } from "@/lib/types";

export function GoalListView({
  visibleGoals,
  allIdeas,
  statusFilter,
  hideCompleted,
  undoAction,
  onStatusFilterChange,
  onToggleHideCompleted,
  onSelect,
  onUndo,
  onDismissUndo,
}: {
  visibleGoals: Idea[];
  allIdeas: Idea[];
  statusFilter: "all" | "open";
  hideCompleted: boolean;
  undoAction: UndoAction | null;
  onStatusFilterChange: (v: "all" | "open") => void;
  onToggleHideCompleted: () => void;
  onSelect: (id: string) => void;
  onUndo: () => void;
  onDismissUndo: () => void;
}) {
  return (
    <AppShell
      title="Goals"
      headerStartActions={
        <>
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
            title="Hide completed goals"
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
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-xs text-gray-400">
          {visibleGoals.length} goal{visibleGoals.length !== 1 ? "s" : ""}
        </p>

        {visibleGoals.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Target size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">No goals found</p>
            <p className="mt-1 text-xs">
              Create a goal in Brainstorm with type &quot;objective&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleGoals.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className="glass-card flex w-full cursor-pointer items-center justify-between rounded-2xl border border-black/5 px-4 py-3 text-left transition hover:border-violet-200 dark:border-white/5 dark:hover:border-violet-800"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/30">
                    <Target size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {p.text || "Untitled goal"}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {p.status.replace("_", " ")} · {getChildCount(p.id, allIdeas)} tasks
                      {p.scheduled_date ? ` · ${p.scheduled_date}` : ""}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-violet-600">Open →</span>
              </button>
            ))}
          </div>
        )}

        <UndoBar undoAction={undoAction} onUndo={onUndo} onDismiss={onDismissUndo} />
      </div>
    </AppShell>
  );
}

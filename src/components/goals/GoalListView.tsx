"use client";

import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ColumnShell, groupKeyOf, type LensColumn } from "@/components/lens";
import { UndoBar } from "@/components/shared/UndoBar";
import { getChildCount } from "@/lib/ideaTreeFocus";
import type { UndoAction } from "@/lib/tasks/undo";
import type { Idea } from "@/lib/types";

interface GoalLensTab {
  key: string;
  label: string;
}

function GoalListColumn({
  column,
  goals,
  allIdeas,
  onSelect,
}: {
  column: LensColumn;
  goals: Idea[];
  allIdeas: Idea[];
  onSelect: (id: string) => void;
}) {
  return (
    <ColumnShell label={column.label} count={goals.length}>
      <div className="space-y-2 p-3">
        {goals.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-gray-400 italic">No goals</p>
        ) : (
          goals.map((goal) => (
            <button
              key={goal.id}
              onClick={() => onSelect(goal.id)}
              className="glass-card flex w-full cursor-pointer items-center justify-between rounded-2xl border border-black/5 px-4 py-3 text-left transition hover:border-violet-200 dark:border-white/5 dark:hover:border-violet-800"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/30">
                  <Target size={16} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {goal.text || "Untitled goal"}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {goal.status.replace("_", " ")} · {getChildCount(goal.id, allIdeas)} tasks
                    {goal.scheduled_date ? ` · ${goal.scheduled_date}` : ""}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-violet-600">Open →</span>
            </button>
          ))
        )}
      </div>
    </ColumnShell>
  );
}

export function GoalListView({
  visibleGoals,
  allIdeas,
  columns,
  groupedGoals,
  lensKey,
  lensTabs,
  statusFilter,
  hideCompleted,
  undoAction,
  onCreateGoal,
  onLensChange,
  onStatusFilterChange,
  onToggleHideCompleted,
  onSelect,
  onUndo,
  onDismissUndo,
}: {
  visibleGoals: Idea[];
  allIdeas: Idea[];
  columns: LensColumn[];
  groupedGoals: Map<string, Idea[]>;
  lensKey: string;
  lensTabs: GoalLensTab[];
  statusFilter: "all" | "open";
  hideCompleted: boolean;
  undoAction: UndoAction | null;
  onCreateGoal: (text: string) => Promise<boolean>;
  onLensChange: (key: string) => void;
  onStatusFilterChange: (v: "all" | "open") => void;
  onToggleHideCompleted: () => void;
  onSelect: (id: string) => void;
  onUndo: () => void;
  onDismissUndo: () => void;
}) {
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const submitGoal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = title.trim();
    if (!text || creating) return;
    setCreating(true);
    try {
      const created = await onCreateGoal(text);
      if (created) {
        setTitle("");
        setComposing(false);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell
      title="Goals"
      headerActions={
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
        >
          <Plus size={13} /> New goal
        </button>
      }
      headerStartActions={
        <>
          <label
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 py-1.5 pr-2.5 pl-3 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
            title="Goal grouping"
          >
            <span className="hidden sm:inline">By</span>
            <select
              value={lensKey}
              onChange={(e) => onLensChange(e.target.value)}
              aria-label="Group goals by"
              className="cursor-pointer bg-transparent font-semibold outline-none"
            >
              {lensTabs.map((tab) => (
                <option key={tab.key} value={tab.key}>
                  {tab.label}
                </option>
              ))}
            </select>
          </label>
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
        {composing && (
          <form
            onSubmit={(event) => void submitGoal(event)}
            className="glass-card flex items-center gap-2 rounded-2xl p-3"
          >
            <input
              autoFocus
              aria-label="Goal title"
              placeholder="What do you want to achieve?"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={creating}
              className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={!title.trim() || creating}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setComposing(false);
                setTitle("");
              }}
              disabled={creating}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-500 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
            >
              Cancel
            </button>
          </form>
        )}
        <p className="text-xs text-gray-400">
          {visibleGoals.length} goal{visibleGoals.length !== 1 ? "s" : ""}
        </p>

        {visibleGoals.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Target size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">No goals found</p>
            <p className="mt-1 text-xs">Select New goal to create your first goal</p>
          </div>
        ) : (
          <div className="space-y-4">
            {columns.map((column) => (
              <GoalListColumn
                key={groupKeyOf(column.key)}
                column={column}
                goals={groupedGoals.get(groupKeyOf(column.key)) ?? []}
                allIdeas={allIdeas}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}

        <UndoBar undoAction={undoAction} onUndo={onUndo} onDismiss={onDismissUndo} />
      </div>
    </AppShell>
  );
}

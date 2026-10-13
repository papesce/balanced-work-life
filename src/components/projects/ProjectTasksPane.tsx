"use client";

import type { ComponentProps } from "react";
import { Plus } from "lucide-react";
import { IdeaTree } from "@/components/brainstorm/IdeaTree";
import { TaskComposer } from "@/components/shared/TaskComposer";
import { groupKeyOf, type LensColumn } from "@/components/lens";
import type { Idea, IdeaNode } from "@/lib/types";

type SharedTreeProps = Omit<ComponentProps<typeof IdeaTree>, "tree" | "hideIds" | "focusedId">;

interface ProjectTasksPaneProps {
  /** Full idea tree; the focus-root's children are grouped from it. */
  tree: IdeaNode[];
  treeProps: SharedTreeProps;
  composerParentText: string | null;
  suggestIdeas: Idea[];
  onComposerAdd: (text: string) => void;
  tasksGroupBy: string | null;
  groupSchemeOptions: { key: string; label: string }[];
  onGroupByChange: (v: string | null) => void;
  /** Null when grouping is off (Manual). Subtrees travel intact — no promotion. */
  groupColumns: LensColumn[] | null;
  groupValueOf: ((id: string) => string | null) | null;
  groupedForest: Map<string, IdeaNode[]> | null;
  hideIds?: Set<string>;
  /** Focus root id for single mode; null re-roots per-group forests. */
  focusId: string;
  onAddTaskInGroup: (value: string | null) => void;
}

export function ProjectTasksPane({
  tree,
  treeProps,
  composerParentText,
  suggestIdeas,
  onComposerAdd,
  tasksGroupBy,
  groupSchemeOptions,
  onGroupByChange,
  groupColumns,
  groupValueOf,
  groupedForest,
  hideIds,
  focusId,
  onAddTaskInGroup,
}: ProjectTasksPaneProps) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="sticky top-0 z-10 bg-white pb-2 dark:bg-gray-950">
        <TaskComposer
          variant="tree"
          placeholder={
            composerParentText ? `+ Add subtask to ${composerParentText}…` : "+ Add task…"
          }
          onCreate={onComposerAdd}
          suggestFrom={suggestIdeas}
          currentView="projects"
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          <label
            htmlFor="tasks-group-by"
            className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500"
          >
            Group
          </label>
          <select
            id="tasks-group-by"
            value={tasksGroupBy ?? ""}
            onChange={(e) => onGroupByChange(e.target.value || null)}
            aria-label="Group tasks by classification"
            className="rounded-lg border border-gray-200 bg-gray-100 px-1.5 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
          >
            <option value="">Manual</option>
            {groupSchemeOptions.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!groupColumns || !groupValueOf || !groupedForest ? (
        <IdeaTree tree={tree} {...treeProps} hideIds={hideIds} focusedId={focusId} />
      ) : (
        <div className="flex flex-col gap-4">
          {groupColumns.map((col) => {
            const forest = groupedForest.get(groupKeyOf(col.key)) ?? [];
            if (forest.length === 0) return null;
            return (
              <section key={groupKeyOf(col.key)} aria-label={col.label}>
                <div className="mb-1 flex items-center gap-2">
                  <h4 className="text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                    {col.label}
                  </h4>
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {forest.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => void onAddTaskInGroup(col.key)}
                    title={`Add task to ${col.label}`}
                    aria-label={`Add task to ${col.label}`}
                    className="rounded-lg p-1 text-gray-400 hover:bg-black/5 hover:text-violet-600"
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <IdeaTree tree={forest} {...treeProps} hideIds={hideIds} focusedId={null} />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import type { ComponentProps, ReactNode } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { TaskComposer } from "@/components/shared/TaskComposer";
import { LinkedEffectsReveal } from "@/components/shared/LinkedEffectsReveal";
import { UndoBar } from "@/components/shared/UndoBar";
import { ProjectPathsTab } from "@/components/projects/ProjectPathsTab";
import type { UndoAction } from "@/lib/tasks/undo";
import type { Idea } from "@/lib/types";
import type { ProjectViewMode } from "@/stores/uiPrefsStore";
import { clampSplitRatio } from "@/lib/projectSplit";
import { hasAnyEffects } from "@/lib/linkEffects";

type PathsProps = ComponentProps<typeof ProjectPathsTab>;
type EffectsProps = Pick<ComponentProps<typeof LinkedEffectsReveal>, "effects" | "completedText">;

interface ProjectDetailViewProps {
  effectiveMode: ProjectViewMode;
  projectSplitRatio: number;
  listPane: ReactNode;
  /** Props forwarded to ProjectPathsTab. */
  paths: PathsProps;
  suggestIdeas: Idea[];
  onComposerAddToPath: (text: string) => void;
  onListResize: (size: { asPercentage: number }) => void;
  onViewModeChange: (mode: ProjectViewMode) => void;
  completionEffects: EffectsProps | null;
  onCloseEffects: () => void;
  undoAction: UndoAction | null;
  onUndo: () => void;
  onDismissUndo: () => void;
}

export function ProjectDetailView({
  effectiveMode,
  projectSplitRatio,
  listPane,
  paths,
  suggestIdeas,
  onComposerAddToPath,
  onListResize,
  onViewModeChange,
  completionEffects,
  onCloseEffects,
  undoAction,
  onUndo,
  onDismissUndo,
}: ProjectDetailViewProps) {
  const pathsPane = <ProjectPathsTab {...paths} />;
  return (
    <>
      {effectiveMode === "split" ? (
        <Group
          orientation="horizontal"
          className="flex h-[calc(100dvh-300px)] min-h-[560px] w-full"
        >
          <Panel
            id="project-list"
            defaultSize={`${clampSplitRatio(projectSplitRatio)}%`}
            minSize="25%"
            onResize={onListResize}
            className="min-w-0"
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  Tasks
                </h3>
                <button
                  onClick={() => onViewModeChange("paths")}
                  title="Collapse list, show paths only"
                  aria-label="Collapse list, show paths only"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-violet-600"
                >
                  <ChevronsLeft size={14} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pr-2">{listPane}</div>
            </div>
          </Panel>
          <Separator
            className="mx-1 w-2 shrink-0 cursor-col-resize rounded-full bg-gray-200 transition-colors hover:bg-violet-300 focus-visible:bg-violet-400 focus-visible:outline-none dark:bg-gray-700 dark:hover:bg-violet-700"
            aria-label="Resize list and paths panes"
          />
          <Panel id="project-paths" minSize="30%" className="min-w-0">
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  Paths
                </h3>
                <button
                  onClick={() => onViewModeChange("list")}
                  title="Collapse paths, show list only"
                  aria-label="Collapse paths, show list only"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-violet-600"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{pathsPane}</div>
            </div>
          </Panel>
        </Group>
      ) : effectiveMode === "paths" ? (
        <div className="flex min-h-0 flex-col gap-2">
          <TaskComposer
            variant="tree"
            placeholder="+ Add task to this path…"
            onCreate={onComposerAddToPath}
            suggestFrom={suggestIdeas}
            currentView="projects"
          />
          {pathsPane}
        </div>
      ) : (
        listPane
      )}
      {completionEffects && hasAnyEffects(completionEffects.effects) && (
        <div className="mt-4">
          <LinkedEffectsReveal
            effects={completionEffects.effects}
            completedText={completionEffects.completedText}
            onClose={onCloseEffects}
          />
        </div>
      )}

      <UndoBar undoAction={undoAction} onUndo={onUndo} onDismiss={onDismissUndo} />
    </>
  );
}

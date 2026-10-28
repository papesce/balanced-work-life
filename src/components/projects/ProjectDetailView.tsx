"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronsDown, ChevronsLeft, ChevronsUp } from "lucide-react";
import { Group, Panel, Separator, type PanelImperativeHandle } from "react-resizable-panels";
import { LinkedEffectsReveal } from "@/components/shared/LinkedEffectsReveal";
import { UndoBar } from "@/components/shared/UndoBar";
import { ProjectPathsTab } from "@/components/projects/ProjectPathsTab";
import type { UndoAction } from "@/lib/tasks/undo";
import type { ProjectViewMode } from "@/stores/uiPrefsStore";
import { clampSplitRatio } from "@/lib/projectSplit";
import { hasAnyEffects } from "@/lib/linkEffects";

type PathsProps = ComponentProps<typeof ProjectPathsTab>;
type EffectsProps = Pick<ComponentProps<typeof LinkedEffectsReveal>, "effects" | "completedText">;

interface ProjectDetailViewProps {
  effectiveMode: ProjectViewMode;
  isNarrow: boolean;
  projectSplitRatio: number;
  listPane: ReactNode;
  /** Props forwarded to ProjectPathsTab. */
  paths: PathsProps;
  pathCanvas: ReactNode;
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
  isNarrow,
  projectSplitRatio,
  listPane,
  paths,
  pathCanvas,
  onListResize,
  onViewModeChange,
  completionEffects,
  onCloseEffects,
  undoAction,
  onUndo,
  onDismissUndo,
}: ProjectDetailViewProps) {
  const [tasksCollapsed, setTasksCollapsed] = useState(false);
  const [pathsCollapsed, setPathsCollapsed] = useState(false);
  const tasksPanelRef = useRef<PanelImperativeHandle | null>(null);
  const pathsPanelRef = useRef<PanelImperativeHandle | null>(null);
  const togglePanel = (
    panelRef: typeof tasksPanelRef,
    setCollapsed: (collapsed: boolean) => void,
  ) => {
    const panel = panelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setCollapsed(false);
    } else {
      panel.collapse();
      setCollapsed(true);
    }
  };
  const pathsPane = (
    <ProjectPathsTab
      {...paths}
      collapsed={pathsCollapsed}
      onToggleCollapsed={() => {
        if (effectiveMode === "split") {
          togglePanel(pathsPanelRef, setPathsCollapsed);
        } else {
          setPathsCollapsed((collapsed) => !collapsed);
        }
      }}
    />
  );
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
            <Group orientation="vertical" className="flex h-full min-h-0 flex-col">
              <Panel
                id="project-tasks"
                panelRef={tasksPanelRef}
                defaultSize="65%"
                minSize="20%"
                collapsedSize="12%"
                collapsible
                className="min-h-0"
              >
                <section className="flex h-full min-h-0 flex-col">
                  <div className="flex min-h-8 items-center justify-between gap-2">
                    <h3 className="text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                      Tasks
                    </h3>
                    <button
                      type="button"
                      onClick={() => togglePanel(tasksPanelRef, setTasksCollapsed)}
                      aria-expanded={!tasksCollapsed}
                      aria-label={
                        tasksCollapsed ? "Expand tasks section" : "Collapse tasks section"
                      }
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-white/5"
                    >
                      {tasksCollapsed ? <ChevronsDown size={14} /> : <ChevronsUp size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewModeChange("paths")}
                      title="Show paths only"
                      aria-label="Show paths only"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-white/5"
                    >
                      <ChevronsLeft size={14} />
                    </button>
                  </div>
                  {!tasksCollapsed && (
                    <div className="min-h-0 flex-1 overflow-y-auto pr-2">{listPane}</div>
                  )}
                </section>
              </Panel>
              <Separator
                className="my-1 h-2 shrink-0 cursor-row-resize rounded-full bg-gray-200 transition-colors hover:bg-violet-300 focus-visible:bg-violet-400 focus-visible:outline-none dark:bg-gray-700 dark:hover:bg-violet-700"
                aria-label="Resize tasks and paths sections"
              />
              <Panel
                id="project-path-list"
                panelRef={pathsPanelRef}
                defaultSize="35%"
                minSize="20%"
                collapsedSize="12%"
                collapsible
                className="min-h-0"
              >
                <div className="flex h-full min-h-0 flex-col overflow-y-auto">{pathsPane}</div>
              </Panel>
            </Group>
          </Panel>
          <Separator
            className="mx-1 w-2 shrink-0 cursor-col-resize rounded-full bg-gray-200 transition-colors hover:bg-violet-300 focus-visible:bg-violet-400 focus-visible:outline-none dark:bg-gray-700 dark:hover:bg-violet-700"
            aria-label="Resize list and paths panes"
          />
          <Panel id="project-paths" minSize="30%" className="min-w-0">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{pathCanvas}</div>
            </div>
          </Panel>
        </Group>
      ) : effectiveMode === "paths" ? (
        isNarrow ? (
          <div className="flex min-h-0 flex-col gap-2">
            <div className="max-h-40 shrink-0 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
              {pathsPane}
            </div>
            <div className="min-h-[65vh] flex-1">{pathCanvas}</div>
          </div>
        ) : (
          <Group
            orientation="horizontal"
            className="flex h-[calc(100dvh-300px)] min-h-[560px] w-full"
          >
            <Panel id="project-path-selector" defaultSize="25%" minSize="18%" className="min-w-0">
              <div className="h-full overflow-y-auto pr-2">{pathsPane}</div>
            </Panel>
            <Separator
              className="mx-1 w-2 shrink-0 cursor-col-resize rounded-full bg-gray-200 transition-colors hover:bg-violet-300 focus-visible:bg-violet-400 focus-visible:outline-none dark:bg-gray-700 dark:hover:bg-violet-700"
              aria-label="Resize paths and canvas"
            />
            <Panel id="project-path-canvas" minSize="35%" className="min-w-0">
              <div className="h-full min-h-0 overflow-hidden">{pathCanvas}</div>
            </Panel>
          </Group>
        )
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

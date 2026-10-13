"use client";

import { useRef } from "react";
import { CornerDownRight, Eye, Link2, MoreHorizontal } from "lucide-react";
import { FloatingPanel } from "@/components/shared/FloatingPanel";
import { LinkPanel } from "@/components/shared/LinkPanel";
import { MoveIdeaPanel } from "@/components/brainstorm/MoveIdeaPanel";
import { RevealInMenu } from "@/components/shared/RevealInMenu";
import { TaskRowMenu } from "@/components/shared/TaskRowMenu";
import type { PlannerRowState } from "@/hooks/usePlannerRowState";
import { getToday } from "@/lib/dateUtils";
import type { RescheduleAction } from "@/lib/tasks/rescheduleTask";
import type { UndoAction } from "@/lib/tasks/undo";
import type { Idea, IdeaLink, LinkType, Tag } from "@/lib/types";

export function PlannerRowMenus({
  task,
  ui,
  onReschedule,
  onUpdate,
  onDelete,
  onUndoAction,
  onAttach,
  allIdeas,
  links,
  onCreateLink,
  onDeleteLink,
  getTagsForIdea,
}: {
  task: Idea;
  ui: PlannerRowState;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
  onUndoAction?: (action: UndoAction) => void;
  onAttach?: (taskId: string, parentId: string) => Promise<void>;
  allIdeas?: Idea[];
  links?: IdeaLink[];
  onCreateLink?: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink?: (id: string) => Promise<void>;
  getTagsForIdea?: (ideaId: string) => Tag[];
}) {
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="relative transition-opacity md:opacity-0 md:group-hover:opacity-100">
      <button
        ref={menuTriggerRef}
        onClick={() => {
          if (ui.showMenu) {
            ui.setShowMenu(false);
            return;
          }
          const rect = menuTriggerRef.current?.getBoundingClientRect();
          if (rect) ui.setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
          ui.setShowMenu(true);
        }}
        className="cursor-pointer text-gray-300 hover:text-gray-500 md:opacity-50 md:hover:opacity-100 dark:text-gray-600"
      >
        <MoreHorizontal size={13} />
      </button>
      {ui.showMenu && ui.menuPos && (
        <FloatingPanel
          anchor={ui.menuPos}
          onClose={() => ui.setShowMenu(false)}
          className="glass-card-strong min-w-[160px] rounded-lg border border-black/5 py-1 shadow-lg dark:border-white/5"
        >
          <TaskRowMenu
            task={task}
            today={getToday()}
            onReschedule={onReschedule}
            onUpdate={onUpdate}
            onDone={() => ui.setShowMenu(false)}
            organizeSection={
              <>
                {onAttach && allIdeas && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        ui.setAttachPos({ top: rect.bottom + 4, left: rect.left });
                        ui.setShowMenu(false);
                        ui.setShowAttachPanel(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                    >
                      <CornerDownRight size={11} strokeWidth={1.5} />
                      Attach to…
                    </button>
                  </div>
                )}
                {onCreateLink && onDeleteLink && allIdeas && links && (
                  <button
                    onClick={() => {
                      const rect = menuTriggerRef.current?.getBoundingClientRect();
                      if (rect)
                        ui.setLinkPanelPos({
                          top: rect.bottom + 6,
                          left: Math.max(8, rect.left - 360),
                        });
                      ui.setShowMenu(false);
                      ui.setShowLinkPanel(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                  >
                    <Link2 size={11} strokeWidth={1.5} />
                    Link…
                  </button>
                )}
              </>
            }
            navigateSection={
              <button
                onClick={() => {
                  const rect = menuTriggerRef.current?.getBoundingClientRect();
                  if (rect)
                    ui.setRevealPos({
                      top: rect.bottom + 6,
                      right: window.innerWidth - rect.right,
                    });
                  ui.setShowMenu(false);
                  ui.setShowReveal(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                <Eye size={11} strokeWidth={1.5} />
                Reveal in...
              </button>
            }
            extraItems={
              <>
                {task.scheduled_time && (
                  <button
                    onClick={() => {
                      onUpdate(task.id, { scheduled_time: null });
                      ui.setShowMenu(false);
                    }}
                    className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                  >
                    Clear time
                  </button>
                )}
                {task.productivity_signal && (
                  <button
                    onClick={() => {
                      const oldSignal = task.productivity_signal;
                      onUpdate(task.id, { productivity_signal: null });
                      onUndoAction?.({
                        label: "Cleared productivity signal",
                        run: async () => {
                          onUpdate(task.id, { productivity_signal: oldSignal });
                        },
                      });
                      ui.setShowMenu(false);
                    }}
                    className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold text-gray-500 hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.04]"
                  >
                    Clear signal
                  </button>
                )}
                <button
                  onClick={() => {
                    const oldSignal = task.productivity_signal;
                    const newSignal = task.productivity_signal === "lazy" ? "productive" : "lazy";
                    onUpdate(task.id, { productivity_signal: newSignal });
                    onUndoAction?.({
                      label: `Marked as ${newSignal === "lazy" ? "Lazy" : "Productive"}`,
                      run: async () => {
                        onUpdate(task.id, { productivity_signal: oldSignal });
                      },
                    });
                    ui.setShowMenu(false);
                  }}
                  className={`flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${
                    task.productivity_signal === "lazy"
                      ? "text-green-600 dark:text-green-400"
                      : "text-orange-600 dark:text-orange-400"
                  }`}
                >
                  {task.productivity_signal === "lazy"
                    ? "🎯 Mark as Productive"
                    : "☕ Mark as Lazy"}
                </button>
              </>
            }
            onDeleteRequest={() => ui.setShowDeleteConfirm(true)}
          />
        </FloatingPanel>
      )}

      {ui.showDeleteConfirm && (
        <FloatingPanel
          anchor={ui.menuPos ?? { top: 0, left: 0 }}
          onClose={() => ui.setShowDeleteConfirm(false)}
          className="glass-card-strong min-w-[180px] rounded-xl border border-red-200 p-2 shadow-lg dark:border-red-500/30"
        >
          <p className="px-1 text-[11px] font-medium text-red-700 dark:text-red-400">
            Delete this task?
          </p>
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              onClick={() => ui.setShowDeleteConfirm(false)}
              className="cursor-pointer rounded-lg px-2 py-1 text-[11px] text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onDelete(task.id);
                ui.setShowDeleteConfirm(false);
              }}
              className="cursor-pointer rounded-lg bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
            >
              Delete
            </button>
          </div>
        </FloatingPanel>
      )}
      {ui.showReveal && ui.revealPos && (
        <RevealInMenu
          idea={task}
          currentView="planner"
          position={ui.revealPos}
          onClose={() => ui.setShowReveal(false)}
        />
      )}
      {ui.showLinkPanel && ui.linkPanelPos && onCreateLink && onDeleteLink && allIdeas && links && (
        <LinkPanel
          ideaId={task.id}
          ideas={allIdeas}
          links={links}
          getTagsForIdea={getTagsForIdea}
          onCreateLink={onCreateLink}
          onDeleteLink={onDeleteLink}
          onClose={() => ui.setShowLinkPanel(false)}
          fixedPosition={ui.linkPanelPos}
        />
      )}
      {ui.showAttachPanel && allIdeas && ui.attachPos && (
        <MoveIdeaPanel
          idea={task}
          ideas={allIdeas}
          variant="attach"
          getTagsForIdea={getTagsForIdea}
          onMove={async (newParentId) => {
            if (onAttach && newParentId) {
              await onAttach(task.id, newParentId);
            }
            ui.setShowAttachPanel(false);
          }}
          onAttach={onAttach ? (parentId) => onAttach(task.id, parentId) : undefined}
          onMoved={() => ui.setShowAttachPanel(false)}
          onClose={() => ui.setShowAttachPanel(false)}
          position={ui.attachPos}
        />
      )}
    </div>
  );
}

"use client";

import { useRef } from "react";
import { Eye, MoreHorizontal } from "lucide-react";
import { FloatingPanel } from "@/components/shared/FloatingPanel";
import { LinkPanel } from "@/components/shared/LinkPanel";
import { MoveIdeaPanel } from "@/components/brainstorm/MoveIdeaPanel";
import { RevealInMenu } from "@/components/shared/RevealInMenu";
import { TaskRowMenu } from "@/components/shared/TaskRowMenu";
import type { TimelineRowState } from "@/hooks/useTimelineRowState";
import type { RescheduleAction } from "@/lib/tasks/rescheduleTask";
import type { Idea, IdeaLink, LinkType } from "@/lib/types";

export function TimelineRowMenus({
  task,
  today,
  ui,
  isHistorical,
  attemptTarget,
  attemptLabel,
  onReschedule,
  onUpdate,
  onMove,
  ideas,
  links,
  onCreateLink,
  onDeleteLink,
  onGoToDate,
}: {
  task: Idea;
  today: string;
  ui: TimelineRowState;
  isHistorical: boolean;
  attemptTarget?: string;
  attemptLabel: string;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onMove?: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  ideas?: Idea[];
  links?: IdeaLink[];
  onCreateLink?: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink?: (id: string) => Promise<void>;
  onGoToDate?: (date: string, taskId: string) => void;
}) {
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="relative">
      <button
        ref={menuTriggerRef}
        onClick={() => {
          if (ui.showMenu) {
            ui.setShowMenu(false);
            return;
          }
          const rect = menuTriggerRef.current?.getBoundingClientRect();
          if (rect) ui.setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
          ui.setShowMenu(true);
        }}
        className={`flex-shrink-0 text-gray-300 transition-all hover:text-gray-500 dark:text-gray-600 ${ui.isHovered || ui.showMenu ? "opacity-100" : "opacity-0"}`}
      >
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>
      {ui.showMenu && ui.menuPos && (
        <FloatingPanel
          anchor={ui.menuPos}
          onClose={() => ui.setShowMenu(false)}
          className="glass-card-strong min-w-[160px] rounded-xl py-1.5 shadow-lg"
        >
          {isHistorical && onGoToDate && attemptTarget && (
            <>
              <button
                onClick={() => {
                  onGoToDate(attemptTarget, task.id);
                  ui.setShowMenu(false);
                }}
                className="flex w-full px-3 py-2 text-left text-xs font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
              >
                {attemptLabel}
              </button>
              <div className="my-1 border-t border-black/5 dark:border-white/5" />
            </>
          )}
          <TaskRowMenu
            task={task}
            today={today}
            onReschedule={onReschedule}
            onUpdate={onUpdate}
            onDone={() => {
              ui.setShowMenu(false);
              ui.setShowAttachPanel(false);
              ui.setShowLinkPanel(false);
            }}
            organizeSection={
              <>
                {onMove && ideas && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        // Flyout to the left of the row so the wide picker
                        // never lands below the menu near the viewport edge.
                        ui.setAttachPos({
                          top: rect.top - 4,
                          right: window.innerWidth - rect.left + 8,
                        });
                        ui.setShowLinkPanel(false);
                        ui.setShowAttachPanel((v) => !v);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                      title="Keeps deferred occurrence on this day, also shows under selected parent"
                    >
                      Attach to…{" "}
                      <span className="text-[10px]">{ui.showAttachPanel ? "▴" : "▸"}</span>
                    </button>
                    {ui.showAttachPanel && ui.attachPos && (
                      <MoveIdeaPanel
                        idea={task}
                        ideas={ideas}
                        variant="attach"
                        onMove={async (newParentId, newSortOrder) => {
                          await onMove(task.id, newParentId, newSortOrder);
                          ui.setShowAttachPanel(false);
                          ui.setShowMenu(false);
                        }}
                        onMoved={() => {
                          ui.setShowAttachPanel(false);
                          ui.setShowMenu(false);
                        }}
                        onClose={() => ui.setShowAttachPanel(false)}
                        position={ui.attachPos}
                      />
                    )}
                  </div>
                )}
                {onCreateLink && onDeleteLink && ideas && links && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        ui.setLinkPanelPos({
                          top: rect.top - 4,
                          right: window.innerWidth - rect.left + 8,
                        });
                        ui.setShowAttachPanel(false);
                        ui.setShowLinkPanel((v) => !v);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                    >
                      Link… <span className="text-[10px]">{ui.showLinkPanel ? "▴" : "▸"}</span>
                    </button>
                    {ui.showLinkPanel && ui.linkPanelPos && (
                      <LinkPanel
                        ideaId={task.id}
                        ideas={ideas}
                        links={links}
                        onCreateLink={onCreateLink}
                        onDeleteLink={onDeleteLink}
                        onClose={() => ui.setShowLinkPanel(false)}
                        fixedPosition={ui.linkPanelPos}
                      />
                    )}
                  </div>
                )}
              </>
            }
            navigateSection={
              <button
                onClick={() => {
                  const rect = menuTriggerRef.current?.getBoundingClientRect();
                  if (rect)
                    ui.setRevealPos({
                      top: rect.bottom + 4,
                      right: window.innerWidth - rect.right,
                    });
                  ui.setShowMenu(false);
                  ui.setShowReveal(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                <Eye size={12} strokeWidth={1.5} />
                Reveal in...
              </button>
            }
          />
        </FloatingPanel>
      )}
      {ui.showReveal && ui.revealPos && (
        <RevealInMenu
          idea={task}
          currentView="timeline"
          position={ui.revealPos}
          onClose={() => ui.setShowReveal(false)}
        />
      )}
      {ui.showLinkPanel &&
        ui.linkPanelPos &&
        !ui.showMenu &&
        onCreateLink &&
        onDeleteLink &&
        ideas &&
        links && (
          <LinkPanel
            ideaId={task.id}
            ideas={ideas}
            links={links}
            onCreateLink={onCreateLink}
            onDeleteLink={onDeleteLink}
            onClose={() => ui.setShowLinkPanel(false)}
            fixedPosition={ui.linkPanelPos}
          />
        )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useDragControls } from "framer-motion";
import { GripVertical, Link2 } from "lucide-react";
import { NotesIndicator } from "@/components/shared/NotesIndicator";
import { PriorityChipField } from "@/components/shared/PriorityChip";
import { useNotes } from "@/contexts/NotesContext";
import { STATUS_CONFIG, PRODUCTIVITY_SIGNALS } from "@/lib/constants";
import { useTimelineRowState } from "@/hooks/useTimelineRowState";
import { RescheduleDragHandle } from "@/components/timeline/RescheduleDragHandle";
import { ParentChip } from "@/components/timeline/row/ParentChip";
import { TagCluster } from "@/components/timeline/row/TagCluster";
import { TimelineRowMenus } from "@/components/timeline/row/TimelineRowMenus";
import { TimelineStatusPill } from "@/components/timeline/row/TimelineStatusPill";
import type { Idea, IdeaLink, LifeArea, LinkType, Tag } from "@/lib/types";
import type { RescheduleAction } from "@/lib/tasks/rescheduleTask";

export interface TimelineTaskRowProps {
  task: Idea;
  occurrenceDate?: string;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onMove?: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  ideas?: Idea[];
  links?: IdeaLink[];
  onCreateLink?: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink?: (id: string) => Promise<void>;
  today: string;
  dragControls: ReturnType<typeof useDragControls>;
  allTags: Tag[];
  taskTags: Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  isHistorical?: boolean;
  onGoToDate?: (date: string, taskId: string) => void;
  /** When set, renders a dnd-kit handle to drag this row onto a week/month day cell. */
  rescheduleDrag?: { taskId: string; fromDate: string; idPrefix: string };
}

export function TimelineTaskRow({
  task,
  occurrenceDate,
  onDone,
  onUndone,
  onUpdate,
  onReschedule,
  onMove,
  ideas,
  links,
  onCreateLink,
  onDeleteLink,
  today,
  dragControls,
  allTags,
  taskTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  isHistorical = false,
  onGoToDate,
  rescheduleDrag,
}: TimelineTaskRowProps) {
  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";
  const isMissed = task.status === "missed";
  const isInProgress = task.status === "in_progress";
  const isPaused = task.status === "paused";
  const statusConfig = STATUS_CONFIG[task.status];
  const attemptTarget = task.scheduled_date ?? task.attempt_dates[task.attempt_dates.length - 1];
  const attemptLabel = task.scheduled_date ? "Go to next attempt" : "Go to last attempt";
  const ui = useTimelineRowState({ task, onUpdate, onDone, onUndone });
  const { showLinkPanel, showMenu, setShowLinkPanel } = ui;
  const { openNotes } = useNotes();
  const inputRef = useRef<HTMLInputElement>(null);
  const linkBadgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (ui.isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [ui.isEditing]);

  useEffect(() => {
    if (!showLinkPanel || showMenu) return;
    const close = () => setShowLinkPanel(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    const handler = (e: MouseEvent) => {
      if (linkBadgeRef.current && !linkBadgeRef.current.contains(e.target as Node)) {
        const linkPanelEl = document.querySelector("[data-link-panel-portal]");
        if (linkPanelEl && linkPanelEl.contains(e.target as Node)) return;
      }
    };
    document.addEventListener("mousedown", handler);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
      document.removeEventListener("mousedown", handler);
    };
  }, [showLinkPanel, showMenu, setShowLinkPanel]);

  const signalCfg =
    task.productivity_signal &&
    PRODUCTIVITY_SIGNALS[task.productivity_signal as keyof typeof PRODUCTIVITY_SIGNALS];

  const linkCount =
    links?.filter((l) => l.source_id === task.id || l.target_id === task.id).length ?? 0;

  return (
    <div
      id={occurrenceDate ? `task-${task.id}-${occurrenceDate}` : undefined}
      className={`group flex items-center gap-1.5 rounded-xl px-3 py-2 transition-colors ${ui.isHovered ? "bg-black/[0.03] dark:bg-white/[0.04]" : ""} ${signalCfg ? "border-b-2" : ""}`}
      style={
        signalCfg
          ? {
              background: signalCfg.bg,
              borderLeft: `3px solid ${signalCfg.color}`,
              borderBottomColor: signalCfg.color,
            }
          : undefined
      }
      onMouseEnter={() => ui.setIsHovered(true)}
      onMouseLeave={() => ui.setIsHovered(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        ui.setRevealPos({ top: e.clientY + 4, right: window.innerWidth - e.clientX - 4 });
        ui.setShowReveal(true);
      }}
      aria-label={signalCfg ? `Productivity: ${signalCfg.label}` : undefined}
    >
      <button
        onPointerDown={(e) => dragControls.start(e)}
        className="flex-shrink-0 cursor-grab text-gray-300 opacity-0 transition-colors group-hover:opacity-100 hover:text-gray-400 active:cursor-grabbing dark:text-gray-600"
        aria-label="Drag to reorder"
      >
        <GripVertical size={12} />
      </button>
      {rescheduleDrag && !isHistorical && (
        <RescheduleDragHandle
          taskId={rescheduleDrag.taskId}
          fromDate={rescheduleDrag.fromDate}
          idPrefix={rescheduleDrag.idPrefix}
        />
      )}

      {statusConfig.icon && (
        <statusConfig.icon
          size={12}
          strokeWidth={2}
          className={`flex-shrink-0 ${statusConfig.textClass}`}
        />
      )}
      {ui.isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={ui.editText}
          onChange={(e) => ui.setEditText(e.target.value)}
          onKeyDown={ui.handleKeyDown}
          onBlur={ui.handleConfirmEdit}
          className="min-w-0 flex-1 rounded-lg border border-violet-300 bg-white/80 px-1.5 py-0.5 text-sm outline-none focus:border-violet-500 dark:border-violet-600 dark:bg-gray-800/80"
        />
      ) : (
        <span
          onClick={ui.handleStartEdit}
          className={`-mx-1 flex-1 cursor-text truncate rounded px-1 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${isCancelled ? "text-red-400/60" : isMissed ? "text-rose-400/60" : ""}`}
          style={{
            fontWeight: 450,
            color: isCompleted
              ? "rgba(107, 114, 128, 0.6)"
              : isCancelled
                ? "rgba(239, 68, 68, 0.5)"
                : isMissed
                  ? "rgba(251, 113, 133, 0.6)"
                  : isPaused
                    ? "rgba(249, 115, 22, 0.7)"
                    : "var(--text-primary)",
          }}
        >
          {task.text}
        </span>
      )}

      {task.scheduled_time && (
        <span className="flex-shrink-0 text-[10px] font-semibold text-violet-600 tabular-nums dark:text-violet-400">
          {task.scheduled_time.slice(0, 5)}
        </span>
      )}

      <ParentChip task={task} ideas={ideas} />
      {linkCount > 0 && (
        <button
          ref={linkBadgeRef}
          aria-label={`View links (${linkCount})`}
          title="View links"
          onClick={(e) => {
            e.stopPropagation();
            if (ui.showLinkPanel) {
              ui.setShowLinkPanel(false);
              return;
            }
            const rect = linkBadgeRef.current?.getBoundingClientRect();
            if (rect) ui.setLinkPanelPos({ top: rect.bottom + 4, left: rect.left });
            ui.setShowMenu(false);
            ui.setShowAttachPanel(false);
            ui.setShowLinkPanel(true);
          }}
          className="flex cursor-pointer items-center gap-0.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
        >
          <Link2 size={10} /> {linkCount}
        </button>
      )}

      <TagCluster
        task={task}
        taskTags={taskTags}
        allTags={allTags}
        ui={ui}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onCreateTag={onCreateTag}
      />

      <TimelineStatusPill
        task={task}
        isCompleted={isCompleted}
        isCancelled={isCancelled}
        isMissed={isMissed}
        isPaused={isPaused}
        isInProgress={isInProgress}
        ui={ui}
      />

      <NotesIndicator hasNotes={!!task.notes?.trim()} onClick={() => openNotes(task.id)} />
      <PriorityChipField ideaId={task.id} />

      {signalCfg && (
        <span
          className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
          style={{ color: signalCfg.color, background: signalCfg.pillBg }}
        >
          {signalCfg.icon}
        </span>
      )}

      <TimelineRowMenus
        task={task}
        today={today}
        ui={ui}
        isHistorical={isHistorical}
        attemptTarget={attemptTarget}
        attemptLabel={attemptLabel}
        onReschedule={onReschedule}
        onUpdate={onUpdate}
        onMove={onMove}
        ideas={ideas}
        links={links}
        onCreateLink={onCreateLink}
        onDeleteLink={onDeleteLink}
        onGoToDate={onGoToDate}
      />
    </div>
  );
}

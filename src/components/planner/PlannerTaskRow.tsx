"use client";

import { useEffect, useRef } from "react";
import { GripVertical, Link2 } from "lucide-react";
import { NotesIndicator } from "@/components/shared/NotesIndicator";
import { PriorityChipField } from "@/components/shared/PriorityChip";
import { useNotes } from "@/contexts/NotesContext";
import { STATUS_CONFIG, PRODUCTIVITY_SIGNALS } from "@/lib/constants";
import { usePlannerRowState } from "@/hooks/usePlannerRowState";
import type { PlannerRowProps } from "@/components/planner/plannerRowTypes";
import { AreaDotTags } from "@/components/planner/row/AreaDotTags";
import { DurationMenu } from "@/components/planner/row/DurationMenu";
import { PlannerRowMenus } from "@/components/planner/row/PlannerRowMenus";
import { RowStatusPill } from "@/components/planner/row/RowStatusPill";

export function PlannerTaskRow({
  task,
  area,
  onDone,
  onUndone,
  onUpdate,
  onDelete,
  onReschedule,
  onMoveTaskBetweenAreas,
  getTagsForIdea,
  allTags,
  onCreateTag,
  onAddTag,
  onRemoveTag,
  showDragHandle,
  dragHandleProps,
  isDragging,
  onUndoAction,
  onAttach,
  allIdeas,
  links,
  onCreateLink,
  onDeleteLink,
}: PlannerRowProps) {
  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";
  const isMissed = task.status === "missed";
  const isPaused = task.status === "paused";
  const isInProgress = task.status === "in_progress";
  const statusConfig = STATUS_CONFIG[task.status];
  const ui = usePlannerRowState({
    task,
    onUpdate,
    onDone,
    onUndone,
    onAddTag,
  });
  const { openNotes } = useNotes();
  const inputRef = useRef<HTMLInputElement>(null);
  const linkBadgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (ui.isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [ui.isEditing]);

  const taskTags = getTagsForIdea?.(task.id) ?? [];
  const signalCfg =
    task.productivity_signal &&
    PRODUCTIVITY_SIGNALS[task.productivity_signal as keyof typeof PRODUCTIVITY_SIGNALS];

  return (
    <div
      id={`task-${task.id}`}
      onContextMenu={(e) => {
        e.preventDefault();
        ui.setRevealPos({ top: e.clientY + 4, right: window.innerWidth - e.clientX - 4 });
        ui.setShowReveal(true);
      }}
      className={`group flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.015] ${
        signalCfg ? "border-b-2" : ""
      } ${isDragging ? "opacity-40" : ""}`}
      style={
        signalCfg
          ? {
              background: signalCfg.bg,
              borderLeft: `3px solid ${signalCfg.color}`,
              borderBottomColor: signalCfg.color,
            }
          : undefined
      }
      aria-label={signalCfg ? `Productivity: ${signalCfg.label}` : undefined}
    >
      {showDragHandle && (
        <div
          {...dragHandleProps?.attributes}
          {...dragHandleProps?.listeners}
          className="flex-shrink-0 cursor-grab touch-none text-gray-300 transition-colors hover:text-gray-400 active:cursor-grabbing md:opacity-0 md:group-hover:opacity-100 dark:text-gray-600"
        >
          <GripVertical size={11} />
        </div>
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
          className="min-w-0 flex-1 rounded-lg border border-violet-300 bg-white/80 px-1.5 py-0.5 text-[13px] font-semibold outline-none focus:border-violet-500 dark:border-violet-600 dark:bg-gray-800/80"
        />
      ) : (
        <span
          onClick={ui.handleStartEdit}
          className={`-mx-1 min-w-0 flex-1 cursor-text truncate rounded px-1 text-[13px] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${
            isCompleted
              ? "font-normal text-gray-400 dark:text-gray-500"
              : isCancelled
                ? "font-normal text-red-400/60"
                : isMissed
                  ? "font-normal text-rose-400/60"
                  : isPaused
                    ? "font-semibold text-orange-600/70 dark:text-orange-400/70"
                    : "font-semibold text-gray-700 dark:text-gray-200"
          }`}
        >
          {task.text}
        </span>
      )}

      <RowStatusPill
        task={task}
        isCompleted={isCompleted}
        isCancelled={isCancelled}
        isMissed={isMissed}
        isPaused={isPaused}
        isInProgress={isInProgress}
        statusLabel={statusConfig.label}
        ui={ui}
      />

      <DurationMenu task={task} ui={ui} onUpdate={onUpdate} />

      {onMoveTaskBetweenAreas && (
        <AreaDotTags
          task={task}
          area={area}
          taskTags={taskTags}
          allTags={allTags}
          ui={ui}
          onRemoveTag={onRemoveTag}
          onCreateTag={onCreateTag}
        />
      )}

      {(() => {
        const count =
          links?.filter((l) => l.source_id === task.id || l.target_id === task.id).length ?? 0;
        if (count === 0) return null;
        return (
          <button
            ref={linkBadgeRef}
            aria-label={`View links (${count})`}
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
              ui.setShowLinkPanel(true);
            }}
            className="flex flex-shrink-0 cursor-pointer items-center gap-0.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
          >
            <Link2 size={10} /> {count}
          </button>
        );
      })()}
      <NotesIndicator hasNotes={!!task.notes?.trim()} onClick={() => openNotes(task.id)} />
      <div className="flex flex-shrink-0 items-center gap-1">
        <PriorityChipField ideaId={task.id} />

        <PlannerRowMenus
          task={task}
          ui={ui}
          onReschedule={onReschedule}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onUndoAction={onUndoAction}
          onAttach={onAttach}
          allIdeas={allIdeas}
          links={links}
          onCreateLink={onCreateLink}
          onDeleteLink={onDeleteLink}
          getTagsForIdea={getTagsForIdea}
        />
      </div>
    </div>
  );
}

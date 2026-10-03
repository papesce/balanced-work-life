"use client";

import { useState, type ReactNode } from "react";
import { addDays, getCurrentTimeRounded } from "@/lib/dateUtils";
import {
  RescheduleAction,
  computeClearDatePatch,
  willRecordAttempt,
} from "@/lib/tasks/rescheduleTask";
import { SchedulePicker } from "@/components/brainstorm/SchedulePicker";
import type { Idea } from "@/lib/types";

export type TaskDateKind = "overdue" | "today" | "future" | "unscheduled";

/** Date-group variant derived from task state only (never from action type). */
export function getTaskDateKind(task: Idea, today: string): TaskDateKind {
  if (task.scheduled_date == null) return "unscheduled";
  if (task.scheduled_date < today || task.status === "deferred") return "overdue";
  if (task.scheduled_date === today) return "today";
  return "future";
}

function formatShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const ITEM_CLASS =
  "flex w-full px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]";
const SUBTEXT_CLASS = "block text-[10px] font-normal text-gray-400 dark:text-gray-500";

function DateItem({
  label,
  subtext,
  emphasized,
  onClick,
}: {
  label: string;
  subtext?: string;
  emphasized?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        emphasized
          ? "flex w-full bg-violet-50/60 px-3 py-2 text-left text-xs font-bold text-violet-700 hover:bg-violet-50 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-950/30"
          : ITEM_CLASS
      }
    >
      <span className="flex-1">
        {label}
        {subtext && <span className={SUBTEXT_CLASS}>{subtext}</span>}
      </span>
    </button>
  );
}

function Separator() {
  return <div className="my-1 border-t border-black/5 dark:border-white/5" />;
}

export interface TaskRowMenuProps {
  task: Idea;
  today: string;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  /** Close the enclosing menu after an action. */
  onDone: () => void;
  /** Organize group content (Attach to… / Link… rows), supplied by the caller. */
  organizeSection?: ReactNode;
  /** Navigate group content (Reveal in… row), supplied by the caller. */
  navigateSection?: ReactNode;
  /** Extra rows rendered between the navigate group and Archive (planner-only items). */
  extraItems?: ReactNode;
  /** Planner-only Delete row (with its own confirm flow); rendered below Archive. */
  onDeleteRequest?: () => void;
}

/**
 * Shared task row action menu, grouped by intent: Date / Organize /
 * Navigate / Destructive. Used by TimelineTaskRow and PendingTaskList.
 */
export function TaskRowMenu({
  task,
  today,
  onReschedule,
  onUpdate,
  onDone,
  organizeSection,
  navigateSection,
  extraItems,
  onDeleteRequest,
}: TaskRowMenuProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const kind = getTaskDateKind(task, today);
  const tomorrow = addDays(today, 1);
  const nowTime = getCurrentTimeRounded(15);

  const run = (action: RescheduleAction) => {
    void onReschedule(task.id, action);
    onDone();
  };

  const clearDate = () => {
    onUpdate(task.id, computeClearDatePatch(task));
    onDone();
  };

  const toggleSubmenu = () => setShowDatePicker((v) => !v);

  const submenuToggle = (label: string) => (
    <button onClick={toggleSubmenu} className={ITEM_CLASS}>
      <span className="flex flex-1 items-center justify-between">
        {label}
        <span className="text-[10px]">{showDatePicker ? "▴" : "▸"}</span>
      </span>
    </button>
  );

  return (
    <>
      {kind === "overdue" && (
        <>
          <DateItem
            label="Carry to today"
            subtext={
              task.scheduled_date &&
              willRecordAttempt(task.scheduled_date, today, task.attempt_dates, today)
                ? `keeps ${formatShort(task.scheduled_date)} as missed`
                : undefined
            }
            emphasized
            onClick={() => run({ type: "reschedule", newDate: today })}
          />
          <DateItem
            label="⚡ Do it now"
            subtext={`today, ${nowTime}`}
            onClick={() => run({ type: "reschedule", newDate: today, time: nowTime })}
          />
          <div className="relative">
            {submenuToggle("Pick another date…")}
            {showDatePicker && (
              <div className="px-2 pb-1">
                <SchedulePicker
                  currentDate={task.scheduled_date}
                  hideToday
                  onSelect={(date) => run({ type: "reschedule", newDate: date })}
                  onClear={clearDate}
                  onClose={() => setShowDatePicker(false)}
                  className="glass-card-strong mt-1 w-full space-y-1 rounded-xl p-2"
                />
                <label
                  htmlFor={`fix-date-${task.id}`}
                  className="mt-1 block px-1 text-[10px] font-medium text-gray-400 dark:text-gray-500"
                >
                  Fix a wrong date (no history)
                </label>
                <input
                  id={`fix-date-${task.id}`}
                  type="date"
                  aria-label="Fix a wrong date (no history)"
                  className="w-full rounded-lg border border-black/10 bg-white/80 px-2 py-1.5 text-xs text-gray-800 focus:ring-1 focus:ring-violet-500 focus:outline-none dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-200"
                  onChange={(e) => {
                    if (e.target.value)
                      run({ type: "reschedule", newDate: e.target.value, recordAttempt: false });
                  }}
                />
              </div>
            )}
          </div>
        </>
      )}
      {kind === "today" && (
        <>
          <DateItem
            label="⚡ Do it now"
            subtext={`today, ${nowTime}`}
            onClick={() => run({ type: "reschedule", newDate: today, time: nowTime })}
          />
          <DateItem
            label="Move to tomorrow"
            onClick={() => run({ type: "reschedule", newDate: tomorrow })}
          />
          <DateItem
            label="Move to tomorrow, mark today as missed"
            subtext="records today as missed"
            onClick={() => run({ type: "reschedule", newDate: tomorrow, recordAttempt: true })}
          />
          <div className="relative">
            {submenuToggle("Pick another date…")}
            {showDatePicker && (
              <SchedulePicker
                currentDate={task.scheduled_date}
                onSelect={(date) => run({ type: "reschedule", newDate: date })}
                onClear={clearDate}
                onClose={() => setShowDatePicker(false)}
                minDate={today}
              />
            )}
          </div>
        </>
      )}
      {(kind === "future" || kind === "unscheduled") && (
        <>
          <DateItem
            label="⚡ Do it now"
            subtext={`today, ${nowTime}`}
            emphasized={kind === "unscheduled"}
            onClick={() => run({ type: "reschedule", newDate: today, time: nowTime })}
          />
          <div className="relative">
            {submenuToggle(kind === "unscheduled" ? "Schedule…" : "Move to…")}
            {showDatePicker && (
              <SchedulePicker
                currentDate={task.scheduled_date}
                onSelect={(date) => run({ type: "reschedule", newDate: date })}
                onClear={clearDate}
                onClose={() => setShowDatePicker(false)}
                minDate={today}
              />
            )}
          </div>
        </>
      )}

      {organizeSection && (
        <>
          <Separator />
          {organizeSection}
        </>
      )}
      {navigateSection && (
        <>
          <Separator />
          {navigateSection}
        </>
      )}
      {extraItems}
      <Separator />
      <button
        onClick={() => {
          onUpdate(task.id, { status: "archived" });
          onDone();
        }}
        className="flex w-full px-3 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20"
      >
        Archive
      </button>
      {onDeleteRequest && (
        <button
          onClick={() => {
            onDeleteRequest();
            onDone();
          }}
          className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
        >
          Delete
        </button>
      )}
    </>
  );
}

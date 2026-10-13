"use client";

import { priorityRank, type PriorityValue } from "@/components/shared/PriorityChip";
import { TASK_STATUS_DOT } from "@/components/timeline/TaskChip";
import type { DayOccurrence } from "@/lib/tasks/rescheduleTask";
import type { WeekCardPreview } from "@/components/timeline/WeekStripView";

/** Day-cell preview body for the four card modes. Pure; lists are tiny. */
export function WeekPreviewContent({
  current,
  preview,
  priorityOf,
  unresolvedCount,
}: {
  current: DayOccurrence[];
  preview: WeekCardPreview;
  priorityOf: (ideaId: string) => PriorityValue;
  unresolvedCount: number;
}) {
  if (current.length === 0) {
    return <p className="px-0.5 py-0.5 text-[10px] text-gray-400 italic">No tasks</p>;
  }
  if (preview === "top") {
    const sorted = [...current].sort((a, b) => {
      const at = a.task.scheduled_time ?? "99";
      const bt = b.task.scheduled_time ?? "99";
      if (at !== bt) return at < bt ? -1 : 1;
      const rankDiff = priorityRank(priorityOf(a.task.id)) - priorityRank(priorityOf(b.task.id));
      if (rankDiff !== 0) return rankDiff;
      const ad =
        a.task.status === "completed" || a.task.status === "cancelled" || a.task.status === "missed"
          ? 1
          : 0;
      const bd =
        b.task.status === "completed" || b.task.status === "cancelled" || b.task.status === "missed"
          ? 1
          : 0;
      return ad - bd;
    });
    const visible = sorted.slice(0, 3);
    const overflow = sorted.length - visible.length;
    return (
      <span className="block min-h-[44px] space-y-px">
        {visible.map((o) => {
          const tDone =
            o.task.status === "completed" ||
            o.task.status === "cancelled" ||
            o.task.status === "missed";
          return (
            <span
              key={o.task.id}
              title={
                o.task.scheduled_time
                  ? `${o.task.text} · ${o.task.scheduled_time.slice(0, 5)}`
                  : o.task.text
              }
              className={`flex w-full items-center gap-1 truncate rounded px-0.5 py-px text-left text-[10px] font-medium ${tDone ? "text-gray-400 line-through" : "text-gray-700 dark:text-gray-200"}`}
            >
              <span
                className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${TASK_STATUS_DOT[o.task.status] ?? TASK_STATUS_DOT.planned}`}
              />
              {o.task.scheduled_time && (
                <span className="flex-shrink-0 font-semibold text-violet-600 tabular-nums dark:text-violet-400">
                  {o.task.scheduled_time.slice(0, 5)}
                </span>
              )}
              <span className="truncate">{o.task.text || "Untitled"}</span>
              {priorityOf(o.task.id) === "high" && (
                <span className="flex-shrink-0 text-[9px] text-amber-400">★</span>
              )}
            </span>
          );
        })}
        {overflow > 0 && (
          <span className="block px-0.5 text-[9px] font-bold text-violet-500">
            +{overflow} more
          </span>
        )}
      </span>
    );
  }
  if (preview === "times") {
    const timed = current
      .filter((o) => o.task.scheduled_time)
      .sort((a, b) => (a.task.scheduled_time! < b.task.scheduled_time! ? -1 : 1));
    const untimed = current.length - timed.length;
    if (timed.length === 0) {
      return (
        <span className="block px-0.5 py-0.5 text-[10px] text-gray-400">
          Untimed · {current.length}
        </span>
      );
    }
    const first = timed[0].task.scheduled_time!.slice(0, 5);
    const last = timed[timed.length - 1].task.scheduled_time!.slice(0, 5);
    return (
      <span className="block space-y-0.5 px-0.5">
        <span className="block text-[11px] font-bold text-gray-700 tabular-nums dark:text-gray-200">
          {first}
          {first !== last ? `–${last}` : ""}
        </span>
        <span className="block text-[10px] text-gray-500">
          {timed.length} timed{untimed > 0 ? ` · ${untimed} untimed` : ""}
        </span>
        <span className="block truncate text-[10px] text-gray-400" title={timed[0].task.text}>
          Next: {timed[0].task.text || "Untitled"}
        </span>
      </span>
    );
  }
  if (preview === "status") {
    const groups: { key: string; label: string; count: number }[] = [
      {
        key: "completed",
        label: "Done",
        count: current.filter(
          (o) =>
            o.task.status === "completed" ||
            o.task.status === "cancelled" ||
            o.task.status === "missed",
        ).length,
      },
      {
        key: "in_progress",
        label: "In Progress",
        count: current.filter(
          (o) =>
            o.task.status === "in_progress" ||
            o.task.status === "scheduled" ||
            o.task.status === "paused",
        ).length,
      },
      {
        key: "planned",
        label: "Planned",
        count: current.filter((o) => o.task.status === "planned" || o.task.status === "deferred")
          .length,
      },
    ];
    return (
      <span className="block min-h-[44px] space-y-0.5 px-0.5">
        {groups.map((g) => (
          <span
            key={g.key}
            className="flex items-center gap-1.5 text-[10px] font-medium text-gray-600 dark:text-gray-300"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${TASK_STATUS_DOT[g.key] ?? TASK_STATUS_DOT.planned}`}
            />
            <span className="tabular-nums">{g.count}</span> {g.label}
          </span>
        ))}
      </span>
    );
  }
  // priority
  const isOpen = (o: (typeof current)[number]) =>
    o.task.status !== "completed" && o.task.status !== "cancelled" && o.task.status !== "missed";
  const ranked = current
    .filter((o) => isOpen(o) && priorityOf(o.task.id) !== null)
    .sort((a, b) => priorityRank(priorityOf(a.task.id)) - priorityRank(priorityOf(b.task.id)));
  const open = current.filter(isOpen);
  const topRanked = ranked.slice(0, 2);
  return (
    <span className="block min-h-[44px] space-y-0.5 px-0.5">
      <span className="flex items-center gap-1 text-[10px] font-bold text-gray-700 dark:text-gray-200">
        <span className="text-amber-400">★</span>
        <span className="tabular-nums">{ranked.length}</span> priority
        {unresolvedCount > 0 && (
          <span className="rounded-full bg-red-100/80 px-1 py-px text-[9px] font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {unresolvedCount} overdue
          </span>
        )}
      </span>
      {topRanked.map((o) => (
        <span
          key={o.task.id}
          className="block truncate text-[10px] text-gray-500"
          title={o.task.text}
        >
          {o.task.scheduled_time ? `${o.task.scheduled_time.slice(0, 5)} ` : ""}
          {o.task.text || "Untitled"}
        </span>
      ))}
      {topRanked.length === 0 && (
        <span className="block text-[10px] text-gray-400">
          {open.length > 0 ? `${open.length} open, none ranked` : "All clear"}
        </span>
      )}
    </span>
  );
}

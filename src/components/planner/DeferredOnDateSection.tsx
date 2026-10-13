"use client";

import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { NotesIndicator } from "@/components/shared/NotesIndicator";
import { useNotes } from "@/contexts/NotesContext";
import { AREA_DOT_COLORS } from "@/lib/constants";
import { getTriageMeta, type DayOccurrence } from "@/lib/tasks/rescheduleTask";
import type { Tag } from "@/lib/types";
import { formatDayLabel } from "@/components/planner/plannerUtils";

export function DeferredOnDateSection({
  occurrences,
  today,
  getTagsForIdea,
}: {
  occurrences: DayOccurrence[];
  today: string;
  getTagsForIdea: (ideaId: string) => Tag[];
}) {
  const { openNotes } = useNotes();
  const router = useRouter();
  return (
    <div className="glass-card overflow-hidden rounded-2xl border border-amber-200/40 dark:border-amber-800/30">
      <div className="flex items-center gap-2 border-b border-amber-200/30 bg-amber-50/40 px-4 py-3 dark:border-amber-800/20 dark:bg-amber-950/10">
        <Clock size={13} className="text-amber-500" />
        <h2 className="text-xs font-bold text-amber-700 dark:text-amber-400">
          Deferred to this day
        </h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
          {occurrences.length}
        </span>
      </div>
      <div className="space-y-1 p-2">
        {occurrences.map(({ task }) => {
          const meta = getTriageMeta(task);
          const tags = getTagsForIdea(task.id);
          const movedLabel = task.scheduled_date
            ? `Moved to ${formatDayLabel(task.scheduled_date, today)}`
            : meta.movedToLabel;
          const visibleTags = tags.slice(0, 2);
          return (
            <div
              key={task.id}
              className="group flex items-center gap-2 rounded-xl border border-black/5 bg-white/60 px-2.5 py-1.5 transition-colors hover:bg-black/[0.015] dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
            >
              <span
                title={movedLabel}
                className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-gray-700 dark:text-gray-200"
              >
                {task.text}
              </span>
              {task.scheduled_date ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/?date=${task.scheduled_date}&highlight=${task.id}`, {
                      scroll: false,
                    })
                  }
                  title={`${movedLabel} · Go to live task`}
                  className="flex-shrink-0 cursor-pointer text-[10px] text-gray-400 tabular-nums hover:text-violet-600 hover:underline dark:text-gray-500 dark:hover:text-violet-400"
                >
                  {`→ ${formatDayLabel(task.scheduled_date, today)}`}
                </button>
              ) : (
                <span
                  title={movedLabel}
                  className="flex-shrink-0 text-[10px] text-gray-400 tabular-nums dark:text-gray-500"
                >
                  {meta.movedToLabel}
                </span>
              )}
              {visibleTags.length > 0 && (
                <span className="hidden flex-shrink-0 items-center gap-1 sm:flex">
                  {visibleTags.map((tag) => (
                    <span
                      key={tag.id}
                      title={tag.name}
                      className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${AREA_DOT_COLORS[tag.area]}`}
                      />
                      <span className="max-w-[80px] truncate">{tag.name}</span>
                    </span>
                  ))}
                  {tags.length > visibleTags.length && (
                    <span className="text-[9px] font-bold text-gray-400">
                      +{tags.length - visibleTags.length}
                    </span>
                  )}
                </span>
              )}
              <span className="flex-shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Deferred
              </span>
              <NotesIndicator hasNotes={!!task.notes?.trim()} onClick={() => openNotes(task.id)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

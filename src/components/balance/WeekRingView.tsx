"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Idea, LifeArea, Tag, getAreasForIdea } from "@/lib/types";
import { toLocalDateString, getWindowRange } from "@/lib/dateUtils";
import { MiniRing } from "./MiniRing";
import { AREA_ORDER } from "@/components/planner/constants";

const AREA_COLORS: Record<LifeArea, string> = {
  work: "#4F6BED",
  health: "#EF4444",
  relationships: "#EC4899",
  growth: "#F59E0B",
  finances: "#10B981",
  life: "#8B5CF6",
};

const AREA_LABELS: Record<LifeArea, string> = {
  work: "Work",
  health: "Health",
  relationships: "Relationships",
  growth: "Growth",
  finances: "Finances",
  life: "Life",
};

interface WeekBucket {
  label: string;
  start: string;
  end: string;
  counts: Record<LifeArea, number>;
}

interface TaskTagRow {
  idea_id: string;
  tag_id: string;
  tags: Tag;
}

function emptyAreaCounts(): Record<LifeArea, number> {
  return { work: 0, health: 0, relationships: 0, growth: 0, finances: 0, life: 0 };
}

function getMondayOf(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d;
}

function buildWeeks(referenceDate: string, count = 8): { label: string; start: string; end: string }[] {
  const monday = getMondayOf(referenceDate);
  // Show 4 weeks before + current + 3 after
  monday.setDate(monday.getDate() - 4 * 7);
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(monday);
    start.setDate(monday.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const s = toLocalDateString(start);
    const e = toLocalDateString(end);
    const label = `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    return { label, start: s, end: e };
  });
}

interface WeekRingViewProps {
  referenceDate: string;
}

export function WeekRingView({ referenceDate }: WeekRingViewProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<WeekBucket[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const weekDefs = buildWeeks(referenceDate, 8);
    const rangeStart = weekDefs[0].start;
    const rangeEnd = weekDefs[weekDefs.length - 1].end;

    const { data: ideasData } = await supabase
      .from("ideas")
      .select("id, scheduled_date")
      .eq("user_id", user.id)
      .eq("type", "task")
      .gte("scheduled_date", rangeStart)
      .lte("scheduled_date", rangeEnd);

    const tasks = (ideasData ?? []) as Pick<Idea, "id" | "scheduled_date">[];
    const taskIds = tasks.map((t) => t.id);

    let tagsByIdea = new Map<string, Tag[]>();
    if (taskIds.length > 0) {
      const { data: taskTagData } = await supabase
        .from("task_tags")
        .select("idea_id, tag_id, tags(*)")
        .in("idea_id", taskIds)
        .eq("tags.user_id", user.id);

      for (const row of (taskTagData ?? []) as unknown as TaskTagRow[]) {
        if (!row.tags) continue;
        const existing = tagsByIdea.get(row.idea_id) ?? [];
        tagsByIdea.set(row.idea_id, [...existing, row.tags]);
      }
    }

    const result: WeekBucket[] = weekDefs.map((w) => {
      const counts = emptyAreaCounts();
      for (const task of tasks) {
        if (!task.scheduled_date) continue;
        if (task.scheduled_date >= w.start && task.scheduled_date <= w.end) {
          const tags = tagsByIdea.get(task.id) ?? [];
          const areas = getAreasForIdea(tags);
          const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);
          for (const area of effectiveAreas) counts[area]++;
        }
      }
      return { ...w, counts };
    });

    setWeeks(result);
    setLoading(false);
  }, [user, referenceDate]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="glass-card rounded-[20px] px-5 py-8 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[20px] px-4 py-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
        Weekly Balance
      </h2>
      <div className="space-y-3">
        {weeks.map((w) => {
          const total = Object.values(w.counts).reduce((s, c) => s + c, 0);
          const activeAreas = (AREA_ORDER as LifeArea[]).filter((a) => w.counts[a] > 0);
          return (
            <div
              key={w.start}
              className="flex items-center gap-4 bg-black/[0.02] dark:bg-white/[0.03] rounded-2xl px-4 py-3"
            >
              <MiniRing counts={w.counts} size={72} showTotal />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  {w.label}
                </div>
                {total === 0 ? (
                  <div className="text-xs text-gray-400 dark:text-gray-500">No tasks</div>
                ) : (
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {activeAreas.map((area) => (
                      <div key={area} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: AREA_COLORS[area] }}
                        />
                        {AREA_LABELS[area]} {w.counts[area]}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

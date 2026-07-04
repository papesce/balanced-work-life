"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import { Idea, LifeArea, Tag, getAreasForIdea } from "@/lib/types";
import { getWindowRange, toLocalDateString, getMonthCalendarGrid } from "@/lib/dateUtils";

interface TaskTagRow {
  idea_id: string;
  tag_id: string;
  tags: Tag;
}

export interface DayData {
  date: string;
  counts: Record<LifeArea, number>;
  isCurrentMonth: boolean;
}

function emptyAreaCounts(): Record<LifeArea, number> {
  return { work: 0, health: 0, relationships: 0, growth: 0, finances: 0, life: 0 };
}

export function useCalendarData(referenceDate: string): {
  loading: boolean;
  dayData: DayData[];
  monthLabel: string;
} {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dayData, setDayData] = useState<DayData[]>([]);

  const ref = new Date(referenceDate + "T00:00:00");
  const monthLabel = ref.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { start, end } = getWindowRange("month", referenceDate);

    const { data: ideasData } = await supabase
      .from("ideas")
      .select("id, scheduled_date, type, status")
      .eq("user_id", user.id)
      .eq("type", "task")
      .gte("scheduled_date", start)
      .lte("scheduled_date", end);

    const tasks = (ideasData ?? []) as Pick<Idea, "id" | "scheduled_date" | "type" | "status">[];
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

    const dayMap = new Map<string, Record<LifeArea, number>>();
    for (const task of tasks) {
      if (!task.scheduled_date) continue;
      if (!dayMap.has(task.scheduled_date)) {
        dayMap.set(task.scheduled_date, emptyAreaCounts());
      }
      const counts = dayMap.get(task.scheduled_date)!;
      const tags = tagsByIdea.get(task.id) ?? [];
      const areas = getAreasForIdea(tags);
      const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);
      for (const area of effectiveAreas) counts[area]++;
    }

    const gridDays = getMonthCalendarGrid(referenceDate);
    const refYear = ref.getFullYear();
    const refMonth = ref.getMonth();

    const result: DayData[] = gridDays.map((date) => {
      const d = new Date(date + "T00:00:00");
      return {
        date,
        counts: dayMap.get(date) ?? emptyAreaCounts(),
        isCurrentMonth: d.getFullYear() === refYear && d.getMonth() === refMonth,
      };
    });

    setDayData(result);
    setLoading(false);
  }, [user, referenceDate]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { loading, dayData, monthLabel };
}

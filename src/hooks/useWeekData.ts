"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { LifeArea } from "@/lib/types";
import { getWeeksInMonth } from "@/lib/dateUtils";
import { emptyAreaCounts, fetchTasksWithTags, getEffectiveAreasForIdea } from "@/lib/taskTags";

export interface WeekBucket {
  label: string;
  start: string;
  end: string;
  counts: Record<LifeArea, number>;
}

export function useWeekData(referenceDate: string): {
  loading: boolean;
  weeks: WeekBucket[];
} {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<WeekBucket[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);

      const weekDefs = getWeeksInMonth(referenceDate);
      const rangeStart = weekDefs[0].start;
      const rangeEnd = weekDefs[weekDefs.length - 1].end;

      const { tasks, tagsByIdea } = await fetchTasksWithTags(user.id, {
        start: rangeStart,
        end: rangeEnd,
        select: "id, scheduled_date",
      });

      const result: WeekBucket[] = weekDefs.map((w) => {
        const counts = emptyAreaCounts();
        for (const task of tasks) {
          if (!task.scheduled_date) continue;
          if (task.scheduled_date >= w.start && task.scheduled_date <= w.end) {
            const effectiveAreas = getEffectiveAreasForIdea(tagsByIdea.get(task.id) ?? []);
            for (const area of effectiveAreas) counts[area]++;
          }
        }
        return { ...w, counts };
      });

      if (!cancelled) {
        setWeeks(result);
        setLoading(false);
      }
    };

    void fetchData();
    return () => { cancelled = true; };
  }, [user, referenceDate]);

  return { loading, weeks };
}

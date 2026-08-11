"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { LifeArea } from "@/lib/types";
import { getWindowRange, getMonthCalendarGrid } from "@/lib/dateUtils";
import { emptyAreaCounts, fetchTasksWithTags, getEffectiveAreasForIdea } from "@/lib/taskTags";

export interface DayData {
  date: string;
  counts: Record<LifeArea, number>;
  isCurrentMonth: boolean;
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);

      const { start, end } = getWindowRange("month", referenceDate);

      const { tasks, tagsByIdea } = await fetchTasksWithTags(user.id, { start, end });

      const dayMap = new Map<string, Record<LifeArea, number>>();
      for (const task of tasks) {
        if (!task.scheduled_date) continue;
        if (!dayMap.has(task.scheduled_date)) {
          dayMap.set(task.scheduled_date, emptyAreaCounts());
        }
        const counts = dayMap.get(task.scheduled_date)!;
        const tags = tagsByIdea.get(task.id) ?? [];
        const effectiveAreas = getEffectiveAreasForIdea(tags);
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

      if (!cancelled) {
        setDayData(result);
        setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [user, referenceDate]);

  return { loading, dayData, monthLabel };
}

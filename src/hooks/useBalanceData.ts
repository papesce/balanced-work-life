"use client";

import { useEffect, useState } from "react";
import { usePowerSync } from "@powersync/react";
import { useAuth } from "./useAuth";
import { LifeArea } from "@/lib/types";
import { WindowType, getWindowRange, getWindowBuckets, getWindowLabel } from "@/lib/dateUtils";
import { AREA_ORDER } from "@/lib/constants";
import { emptyAreaCounts, fetchTasksWithTags, getEffectiveAreasForIdea } from "@/lib/taskTags";
import { loadAreaTargets } from "@/lib/storage";

export interface RadarDataPoint {
  area: LifeArea;
  actual: number;
  target: number;
}

export interface BucketData {
  label: string;
  counts: Record<LifeArea, number>;
}

export interface BalanceData {
  loading: boolean;
  radarData: RadarDataPoint[];
  buckets: BucketData[];
  windowLabel: string;
}

export function useBalanceData(windowType: WindowType, referenceDate: string): BalanceData {
  const { user } = useAuth();
  const db = usePowerSync();
  const [loading, setLoading] = useState(true);
  const [radarData, setRadarData] = useState<RadarDataPoint[]>([]);
  const [buckets, setBuckets] = useState<BucketData[]>([]);

  const windowLabel = getWindowLabel(windowType, referenceDate);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      const { start, end } = getWindowRange(windowType, referenceDate);

      const { tasks, tagsByIdea } = await fetchTasksWithTags(db, user.id, { start, end });

      const targets = loadAreaTargets();

      // Aggregate radar counts
      const totalCounts = emptyAreaCounts();
      for (const task of tasks) {
        const tags = tagsByIdea.get(task.id) ?? [];
        const effectiveAreas = getEffectiveAreasForIdea(tags);
        for (const area of effectiveAreas) totalCounts[area]++;
      }

      const total = Object.values(totalCounts).reduce((s, c) => s + c, 0);
      const radar: RadarDataPoint[] = AREA_ORDER.map((area) => ({
        area,
        actual: total > 0 ? Math.round((totalCounts[area] / total) * 100) : 0,
        target: targets[area],
      }));

      // Aggregate per-bucket counts
      const windowBuckets = getWindowBuckets(windowType, referenceDate);
      const bucketData: BucketData[] = windowBuckets.map((b) => {
        const counts = emptyAreaCounts();
        for (const task of tasks) {
          if (!task.scheduled_date) continue;
          if (task.scheduled_date >= b.start && task.scheduled_date <= b.end) {
            const tags = tagsByIdea.get(task.id) ?? [];
            const effectiveAreas = getEffectiveAreasForIdea(tags);
            for (const area of effectiveAreas) counts[area]++;
          }
        }
        return { label: b.label, counts };
      });

      if (!cancelled) {
        setRadarData(radar);
        setBuckets(bucketData);
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user, db, windowType, referenceDate]);

  return { loading, radarData, buckets, windowLabel };
}

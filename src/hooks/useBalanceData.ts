"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import { Idea, LifeArea, Tag, getAreasForIdea } from "@/lib/types";
import {
  WindowType,
  getWindowRange,
  getWindowBuckets,
  getWindowLabel,
} from "@/lib/dateUtils";
import { AREA_ORDER, DEFAULT_TARGETS, LOCAL_STORAGE_TARGETS_KEY } from "@/components/planner/constants";

interface TaskTagRow {
  idea_id: string;
  tag_id: string;
  tags: Tag;
}

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

function emptyAreaCounts(): Record<LifeArea, number> {
  return { work: 0, health: 0, relationships: 0, growth: 0, finances: 0, life: 0 };
}

function loadTargets(): Record<LifeArea, number> {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_TARGETS_KEY);
    if (stored) return JSON.parse(stored) as Record<LifeArea, number>;
  } catch {}
  return DEFAULT_TARGETS;
}

export function useBalanceData(windowType: WindowType, referenceDate: string): BalanceData {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [radarData, setRadarData] = useState<RadarDataPoint[]>([]);
  const [buckets, setBuckets] = useState<BucketData[]>([]);

  const windowLabel = getWindowLabel(windowType, referenceDate);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { start, end } = getWindowRange(windowType, referenceDate);

    // Fetch tasks in range
    const { data: ideasData } = await supabase
      .from("ideas")
      .select("id, scheduled_date, type, status")
      .eq("user_id", user.id)
      .eq("type", "task")
      .gte("scheduled_date", start)
      .lte("scheduled_date", end);

    const tasks = (ideasData ?? []) as Pick<Idea, "id" | "scheduled_date" | "type" | "status">[];
    const taskIds = tasks.map((t) => t.id);

    // Fetch tags for those tasks
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

    const targets = loadTargets();

    // Aggregate radar counts
    const totalCounts = emptyAreaCounts();
    for (const task of tasks) {
      const tags = tagsByIdea.get(task.id) ?? [];
      const areas = getAreasForIdea(tags);
      const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);
      for (const area of effectiveAreas) totalCounts[area]++;
    }

    const total = Object.values(totalCounts).reduce((s, c) => s + c, 0);
    const radar: RadarDataPoint[] = AREA_ORDER.map((area) => ({
      area,
      actual: total > 0 ? Math.round((totalCounts[area] / total) * 100) : 0,
      target: targets[area] ?? DEFAULT_TARGETS[area],
    }));

    // Aggregate per-bucket counts
    const windowBuckets = getWindowBuckets(windowType, referenceDate);
    const bucketData: BucketData[] = windowBuckets.map((b) => {
      const counts = emptyAreaCounts();
      for (const task of tasks) {
        if (!task.scheduled_date) continue;
        if (task.scheduled_date >= b.start && task.scheduled_date <= b.end) {
          const tags = tagsByIdea.get(task.id) ?? [];
          const areas = getAreasForIdea(tags);
          const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);
          for (const area of effectiveAreas) counts[area]++;
        }
      }
      return { label: b.label, counts };
    });

    setRadarData(radar);
    setBuckets(bucketData);
    setLoading(false);
  }, [user, windowType, referenceDate]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { loading, radarData, buckets, windowLabel };
}

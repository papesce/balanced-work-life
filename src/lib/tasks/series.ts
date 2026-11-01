import { DONE_STATUSES } from "@/lib/ideaSearch";
import type { Idea } from "@/lib/types";

type SeriesInstance = Pick<Idea, "id" | "series_id" | "status" | "completed_at">;

const DAY_MS = 24 * 60 * 60 * 1000;

function isCompletion(instance: SeriesInstance): boolean {
  return (
    instance.completed_at !== null &&
    (instance.status === "completed" || instance.status === "archived")
  );
}

function completedTimestamps(instances: SeriesInstance[]): number[] {
  return instances
    .filter(isCompletion)
    .map((instance) => Date.parse(instance.completed_at!))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

export function seriesIdForAdoption(instance: Pick<Idea, "id" | "series_id">): string {
  return instance.series_id ?? instance.id;
}

export function lastCompletedAt(instances: SeriesInstance[]): string | null {
  let latest: { value: number; timestamp: string } | null = null;
  for (const instance of instances) {
    if (!isCompletion(instance)) continue;
    const value = Date.parse(instance.completed_at!);
    if (Number.isFinite(value) && (!latest || value > latest.value)) {
      latest = { value, timestamp: instance.completed_at! };
    }
  }
  return latest?.timestamp ?? null;
}

export function daysSinceLastCompleted(
  instances: SeriesInstance[],
  now: Date | string,
): number | null {
  const completedAt = lastCompletedAt(instances);
  if (!completedAt) return null;
  const elapsed =
    Date.parse(typeof now === "string" ? now : now.toISOString()) - Date.parse(completedAt);
  return Math.max(0, Math.floor(elapsed / DAY_MS));
}

export function typicalIntervalDays(instances: SeriesInstance[]): number | null {
  const timestamps = completedTimestamps(instances);
  if (timestamps.length < 2) return null;
  const gaps = timestamps.slice(1).map((value, index) => (value - timestamps[index]) / DAY_MS);
  gaps.sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 1 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2;
}

export function isOpenSeriesInstance(instance: Pick<Idea, "status">): boolean {
  return !DONE_STATUSES.includes(instance.status);
}

export function findOpenSeriesInstance(instances: Idea[], seriesId: string): Idea | null {
  return (
    instances.find(
      (instance) => instance.series_id === seriesId && isOpenSeriesInstance(instance),
    ) ?? null
  );
}

export function unlinkFromSeries<T extends Idea>(instance: T): T {
  return { ...instance, series_id: null };
}

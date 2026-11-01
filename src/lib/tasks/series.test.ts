import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  daysSinceLastCompleted,
  findOpenSeriesInstance,
  isOpenSeriesInstance,
  lastCompletedAt,
  seriesIdForAdoption,
  typicalIntervalDays,
  unlinkFromSeries,
} from "./series";
import type { Idea } from "@/lib/types";

function instance(
  id: string,
  status: Idea["status"],
  completed_at: string | null = null,
  series_id: string | null = "series",
): Idea {
  return {
    id,
    user_id: "user",
    parent_id: null,
    series_id,
    text: id,
    description: null,
    type: "task",
    effort: null,
    impact: null,
    urgency: null,
    scheduled_date: null,
    scheduled_time: null,
    duration_minutes: null,
    is_priority: false,
    priority_order: null,
    status,
    notes: null,
    why: null,
    completed_at,
    cancelled_at: null,
    paused_at: null,
    attempt_dates: [],
    status_history: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("task series", () => {
  it("adopts an instance using its own id or its existing series id", () => {
    assert.equal(seriesIdForAdoption(instance("first", "completed", null, null)), "first");
    assert.equal(seriesIdForAdoption(instance("later", "completed", null, "first")), "first");
  });

  it("computes the latest completion and elapsed whole days from completed instances", () => {
    const instances = [
      instance("old", "completed", "2026-01-01T00:00:00.000Z"),
      instance("new", "completed", "2026-01-04T12:00:00.000Z"),
      instance("reopened", "scheduled", "2026-01-05T00:00:00.000Z"),
      instance("cancelled", "cancelled", "2026-01-06T00:00:00.000Z"),
      instance("missed", "missed", "2026-01-07T00:00:00.000Z"),
    ];
    assert.equal(lastCompletedAt(instances), "2026-01-04T12:00:00.000Z");
    assert.equal(daysSinceLastCompleted(instances, "2026-01-07T11:00:00.000Z"), 2);
    assert.equal(daysSinceLastCompleted([], "2026-01-07T11:00:00.000Z"), null);
  });

  it("counts archived instances only when they retain a completion timestamp", () => {
    const archived = [
      instance("done-then-archived", "archived", "2026-01-03T00:00:00.000Z"),
      instance("archived-uncompleted", "archived"),
    ];
    assert.equal(lastCompletedAt(archived), "2026-01-03T00:00:00.000Z");
    assert.equal(
      typicalIntervalDays([
        ...archived,
        instance("completed", "completed", "2026-01-05T00:00:00.000Z"),
      ]),
      2,
    );
  });

  it("uses the median gap and returns null with fewer than two completions", () => {
    const completions = [
      instance("a", "completed", "2026-01-01T00:00:00.000Z"),
      instance("b", "completed", "2026-01-02T00:00:00.000Z"),
      instance("c", "completed", "2026-01-12T00:00:00.000Z"),
      instance("d", "completed", "2026-01-13T00:00:00.000Z"),
    ];
    assert.equal(typicalIntervalDays(completions), 1);
    assert.equal(typicalIntervalDays(completions.slice(0, 1)), null);
    assert.equal(
      typicalIntervalDays([
        instance("one", "completed", "2026-01-01T00:00:00.000Z"),
        instance("two", "completed", "2026-01-04T00:00:00.000Z"),
        instance("three", "completed", "2026-01-10T00:00:00.000Z"),
      ]),
      4.5,
    );
  });

  it("treats paused and deferred as open and finds an open instance anywhere in a series", () => {
    assert.equal(isOpenSeriesInstance(instance("paused", "paused")), true);
    assert.equal(isOpenSeriesInstance(instance("deferred", "deferred")), true);
    const openOccurrence = instance("open", "paused", null, "series");
    assert.equal(
      findOpenSeriesInstance(
        [instance("matched", "completed", "2026-01-01T00:00:00.000Z"), openOccurrence],
        "series",
      )?.id,
      "open",
    );
    assert.equal(findOpenSeriesInstance([openOccurrence], "other"), null);
  });

  it("unlinks only the series id", () => {
    const original = instance("first", "completed", "2026-01-01T00:00:00.000Z");
    assert.deepEqual(unlinkFromSeries(original), { ...original, series_id: null });
    assert.equal(original.series_id, "series");
  });
});

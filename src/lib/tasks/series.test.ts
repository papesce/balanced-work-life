import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  daysSinceLastCompleted,
  findUnlinkedPastTaskOccurrences,
  findOpenSeriesInstance,
  isUnlinkedPastTaskOccurrence,
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

  it("suggests only matching, completed, unlinked task occurrences from before the current task", () => {
    const current = {
      ...instance("current", "scheduled", null, null),
      text: "weekly report",
      created_at: "2026-03-01T00:00:00.000Z",
    };
    const match = {
      ...instance("match", "completed", "2026-02-01T00:00:00.000Z", null),
      text: "Weekly report",
    };
    const archivedMatch = {
      ...instance("archived-match", "archived", "2026-02-15T00:00:00.000Z", null),
      text: "weekly report",
    };
    const linkedMatch = {
      ...instance("linked", "completed", "2026-02-02T00:00:00.000Z"),
      text: "weekly report",
    };
    const recentMatch = {
      ...instance("recent", "completed", "2026-03-02T00:00:00.000Z", null),
      text: "weekly report",
    };
    const unrelated = {
      ...instance("unrelated", "completed", "2026-02-03T00:00:00.000Z", null),
      text: "plan vacation",
    };

    assert.deepEqual(
      findUnlinkedPastTaskOccurrences(
        [current, match, archivedMatch, linkedMatch, recentMatch, unrelated],
        current,
      ).map(({ id }) => id),
      ["archived-match", "match"],
    );
    assert.equal(isUnlinkedPastTaskOccurrence(match, current), true);
    assert.equal(isUnlinkedPastTaskOccurrence(archivedMatch, current), true);
    assert.equal(isUnlinkedPastTaskOccurrence(linkedMatch, current), false);
    assert.equal(isUnlinkedPastTaskOccurrence(recentMatch, current), false);
    assert.equal(isUnlinkedPastTaskOccurrence({ ...match, status: "cancelled" }, current), false);
    assert.equal(isUnlinkedPastTaskOccurrence({ ...match, type: "idea" }, current), false);
    assert.equal(
      isUnlinkedPastTaskOccurrence({ ...match, completed_at: "invalid" }, current),
      false,
    );
  });

  it("sorts suggested matches newest first and caps the result", () => {
    const current = {
      ...instance("current", "scheduled", null, null),
      text: "weekly report",
      created_at: "2026-03-01T00:00:00.000Z",
    };
    const matches = Array.from({ length: 7 }, (_, index) => ({
      ...instance(
        `match-${index}`,
        "completed",
        `2026-02-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        null,
      ),
      text: "weekly report",
    }));

    assert.deepEqual(
      findUnlinkedPastTaskOccurrences([current, ...matches], current).map(({ id }) => id),
      ["match-6", "match-5", "match-4", "match-3", "match-2"],
    );
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

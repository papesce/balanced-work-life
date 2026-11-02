import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildEventsQuery, groupEventsByDate, selectEventsForRange } from "@/lib/eventModel";
import { normalizeBackup, type BackupData } from "@/lib/backup";
import { getDatesRange } from "@/lib/dateUtils";
import { buildRenderPlan } from "@/lib/timelinePresets";
import type { Idea } from "@/lib/types";

function event(
  id: string,
  date: string | null,
  time: string | null,
  duration: number | null = null,
): Idea {
  return {
    id,
    user_id: "user-1",
    parent_id: null,
    series_id: null,
    text: id,
    description: null,
    type: "event",
    effort: null,
    impact: null,
    urgency: null,
    scheduled_date: date,
    scheduled_time: time,
    duration_minutes: duration,
    is_priority: false,
    priority_order: null,
    status: "not_applicable",
    notes: null,
    why: null,
    completed_at: null,
    cancelled_at: null,
    paused_at: null,
    attempt_dates: [],
    status_history: null,
    sort_order: 0,
    created_at: "",
    updated_at: "",
  };
}

describe("event selectors", () => {
  const events = [
    event("all-day", "2026-11-02", null),
    event("timed", "2026-11-02", "09:30"),
    event("duration", "2026-11-03", "10:00", 90),
    event("no-date", null, null),
  ];

  it("selects scheduled root events within inclusive date ranges", () => {
    assert.deepEqual(
      selectEventsForRange(events, "2026-11-02", "2026-11-02").map((idea) => idea.id),
      ["all-day", "timed"],
    );
    assert.equal(selectEventsForRange(events, "2026-11-03", "2026-11-03")[0].id, "duration");
    assert.deepEqual(
      selectEventsForRange(events, "2026-11-02", "2026-11-08").map((idea) => idea.id),
      ["all-day", "timed", "duration"],
    );
    assert.deepEqual(
      selectEventsForRange(events, "2026-11-01", "2026-11-30").map((idea) => idea.id),
      ["all-day", "timed", "duration"],
    );
  });

  it("groups all-day, timed, and duration events by day in time order", () => {
    const grouped = groupEventsByDate(events);
    assert.deepEqual(
      grouped["2026-11-02"].map((idea) => idea.id),
      ["all-day", "timed"],
    );
    assert.equal(grouped["2026-11-03"][0].duration_minutes, 90);
    assert.equal(grouped["2026-11-03"][0].scheduled_time, "10:00");
  });

  it("queries only root events in the requested date range", () => {
    const query = buildEventsQuery("user-1", "2026-11-02", "2026-11-08");
    assert.match(query.sql, /type = 'event'/);
    assert.match(query.sql, /parent_id IS NULL/);
    assert.deepEqual(query.params, ["user-1", "2026-11-02", "2026-11-08"]);
  });

  it("preserves event date, time, duration, and type through backup normalization", () => {
    const source = event("concert", "2026-11-02", "19:30", 120);
    const backup = normalizeBackup({
      ideas: [source],
      ideaLinks: [],
    } as unknown as BackupData);
    assert.equal(backup.ideas[0].type, "event");
    assert.equal(backup.ideas[0].scheduled_date, "2026-11-02");
    assert.equal(backup.ideas[0].scheduled_time, "19:30");
    assert.equal(backup.ideas[0].duration_minutes, 120);
  });

  it("keeps event dates visible in compressed agenda ranges", () => {
    const anchor = "2026-11-02";
    const dates = getDatesRange(40, 40, anchor);
    const eventDate = dates[0];
    const plan = buildRenderPlan(dates, {}, true, anchor, new Set([eventDate]));
    assert.ok(plan.some((unit) => unit.kind === "day" && unit.date === eventDate));
  });
});

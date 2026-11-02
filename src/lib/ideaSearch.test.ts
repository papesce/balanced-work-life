import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DONE_STATUSES } from "@/lib/ideaSearch";
import { TERMINAL_STATUSES } from "@/lib/constants";
import { searchIdeas } from "@/lib/ideaSearch";
import {
  getDayOccurrences,
  getDeferredOccurrences,
  isActiveOccurrence,
} from "@/lib/tasks/rescheduleTask";
import { ACTIVE_STATUSES } from "@/lib/horizonBoard";
import type { Idea } from "@/lib/types";

function idea(overrides: Partial<Idea>): Idea {
  return {
    id: "idea-1",
    user_id: "user-1",
    parent_id: null,
    series_id: null,
    text: "Birthday dinner",
    description: null,
    type: "task",
    effort: null,
    impact: null,
    urgency: null,
    scheduled_date: "2026-11-02",
    scheduled_time: null,
    duration_minutes: null,
    is_priority: false,
    priority_order: null,
    status: "planned",
    notes: null,
    why: null,
    completed_at: null,
    cancelled_at: null,
    paused_at: null,
    attempt_dates: [],
    status_history: null,
    sort_order: 0,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

describe("task suggestions and neutral status", () => {
  const task = idea({ id: "task", text: "birthday dinner" });
  const event = idea({
    id: "event",
    type: "event",
    status: "not_applicable",
    text: "birthday dinner event",
  });

  it("keeps events out of task suggestions unless explicitly requested", () => {
    assert.deepEqual(
      searchIdeas([task, event], "birthday").map((item) => item.id),
      ["task"],
    );
    assert.deepEqual(
      searchIdeas([task, event], "birthday", { includeEvents: true }).map((item) => item.id),
      ["task", "event"],
    );
  });

  it("does not treat not_applicable as active, missed, deferred, or terminal", () => {
    const neutralTask = idea({
      status: "not_applicable",
      attempt_dates: ["2026-11-01"],
    });
    assert.equal(ACTIVE_STATUSES.has("not_applicable"), false);
    assert.equal(TERMINAL_STATUSES.includes("not_applicable"), false);
    assert.equal(DONE_STATUSES.includes("not_applicable"), false);
    assert.equal(
      isActiveOccurrence({ task: neutralTask, date: "2026-11-01", isHistorical: true }),
      false,
    );
    assert.deepEqual(getDayOccurrences([neutralTask], "2026-11-02", "2026-11-02", true), []);
    assert.deepEqual(getDeferredOccurrences([neutralTask], "2026-11-02"), []);
  });
});

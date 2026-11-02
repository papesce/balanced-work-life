import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isEvent, isTask } from "@/lib/ideaPredicates";
import { hasExactMatch, PARENT_TYPE_OPTIONS } from "@/lib/ideaParentType";
import type { Idea } from "@/lib/types";

function idea(type: Idea["type"]): Idea {
  return {
    id: "idea-1",
    user_id: "user-1",
    parent_id: null,
    series_id: null,
    text: "",
    description: null,
    type,
    effort: null,
    impact: null,
    urgency: null,
    scheduled_date: null,
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
    created_at: "",
    updated_at: "",
  };
}

describe("idea predicates", () => {
  it("recognizes only task ideas as tasks", () => {
    assert.equal(isTask(idea("task")), true);
    for (const type of [
      "event",
      "idea",
      "objective",
      "project",
      "initiative",
      "path",
      null,
    ] as const) {
      assert.equal(isTask(idea(type)), false, `${type} is not a task`);
    }
  });

  it("recognizes only calendar events as events", () => {
    assert.equal(isEvent(idea("event")), true);
    for (const type of [
      "task",
      "idea",
      "objective",
      "project",
      "initiative",
      "path",
      null,
    ] as const) {
      assert.equal(isEvent(idea(type)), false, `${type} is not an event`);
    }
  });

  it("keeps events out of parent creation and parent search matches", () => {
    assert.equal(PARENT_TYPE_OPTIONS.includes("event"), false);
    assert.equal(hasExactMatch([{ text: "Birthday", type: "event" }], "Birthday"), false);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { topLevelSortOrder } from "@/lib/ideaTreeMove";
import type { Idea, IdeaStatus } from "@/lib/types";

let n = 0;
function idea(overrides: Partial<Idea> & { id: string }): Idea {
  n += 1;
  return {
    user_id: "u",
    parent_id: null,
    text: `t${n}`,
    description: null,
    type: "task",
    status: "draft" as IdeaStatus,
    effort: null,
    impact: null,
    urgency: null,
    scheduled_date: null,
    scheduled_time: null,
    duration_minutes: null,
    is_priority: false,
    priority_order: null,
    notes: null,
    why: null,
    completed_at: null,
    cancelled_at: null,
    paused_at: null,
    attempt_dates: [],
    status_history: null,
    sort_order: n,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  };
}

describe("topLevelSortOrder", () => {
  it("appends after the last root", () => {
    const a = idea({ id: "a", sort_order: 0 });
    const b = idea({ id: "b", sort_order: 1 });
    const moved = idea({ id: "moved", parent_id: "a", sort_order: 0 });
    assert.equal(topLevelSortOrder([a, b, moved], "moved"), 2);
  });

  it("ignores the moved idea when it is already a root", () => {
    const a = idea({ id: "a", sort_order: 0 });
    const moved = idea({ id: "moved", sort_order: 5 });
    assert.equal(topLevelSortOrder([a, moved], "moved"), 1);
  });

  it("returns 0 when there are no other roots", () => {
    const moved = idea({ id: "moved", parent_id: "p", sort_order: 0 });
    assert.equal(topLevelSortOrder([moved], "moved"), 0);
  });

  it("handles gaps in root sort orders", () => {
    const a = idea({ id: "a", sort_order: 0 });
    const b = idea({ id: "b", sort_order: 7 });
    const moved = idea({ id: "moved", parent_id: "a", sort_order: 0 });
    assert.equal(topLevelSortOrder([a, b, moved], "moved"), 8);
  });
});

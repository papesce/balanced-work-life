import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterUncommitted, isCommitted, isUncommitted } from "@/lib/horizonScope";
import type { Idea, IdeaStatus } from "@/lib/types";

let n = 0;
function idea(overrides: Partial<Idea> & { id: string; status: IdeaStatus }): Idea {
  n += 1;
  return {
    user_id: "u",
    parent_id: null,
    text: `t${n}`,
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

describe("isUncommitted / isCommitted", () => {
  it("undated draft and planned items are uncommitted", () => {
    for (const status of ["draft", "planned"] as IdeaStatus[]) {
      const i = idea({ id: `i-${status}`, status });
      assert.equal(isUncommitted(i), true, status);
      assert.equal(isCommitted(i), false, status);
    }
  });

  it("scheduled and in_progress items are committed", () => {
    for (const status of ["scheduled", "in_progress"] as IdeaStatus[]) {
      const i = idea({ id: `i-${status}`, status });
      assert.equal(isCommitted(i), true, status);
      assert.equal(isUncommitted(i), false, status);
    }
  });

  it("any item with a scheduled_date is committed, even draft/planned", () => {
    for (const status of ["draft", "planned"] as IdeaStatus[]) {
      const i = idea({ id: `i-${status}-dated`, status, scheduled_date: "2026-10-12" });
      assert.equal(isCommitted(i), true, status);
    }
  });

  it("paused, deferred and terminal items are not uncommitted", () => {
    for (const status of ["paused", "deferred", "completed", "cancelled"] as IdeaStatus[]) {
      const i = idea({ id: `i-${status}`, status });
      assert.equal(isUncommitted(i), false, status);
    }
  });
});

describe("filterUncommitted", () => {
  it("keeps only the future decisions", () => {
    const draft = idea({ id: "draft", status: "draft" });
    const planned = idea({ id: "planned", status: "planned" });
    const dated = idea({ id: "dated", status: "planned", scheduled_date: "2026-10-12" });
    const scheduled = idea({ id: "scheduled", status: "scheduled" });
    const active = idea({ id: "active", status: "in_progress" });
    assert.deepEqual(
      filterUncommitted([draft, planned, dated, scheduled, active]).map((i) => i.id),
      ["draft", "planned"],
    );
  });

  it("in-progress project shell drops but its unstarted tasks survive", () => {
    const p = idea({ id: "p", status: "in_progress" });
    const started = idea({ id: "started", status: "in_progress", parent_id: "p" });
    const pending = idea({ id: "pending", status: "draft", parent_id: "p" });
    assert.deepEqual(
      filterUncommitted([p, started, pending]).map((i) => i.id),
      ["pending"],
    );
  });
});

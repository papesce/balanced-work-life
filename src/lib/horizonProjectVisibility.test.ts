import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getHiddenProjectIds } from "@/lib/horizonProjectVisibility";
import type { Idea, IdeaStatus, IdeaType } from "@/lib/types";

let n = 0;
function idea(
  overrides: Partial<Idea> & { id: string; type: IdeaType | null; status: IdeaStatus },
): Idea {
  n += 1;
  return {
    user_id: "u",
    parent_id: null,
    text: `t${n}`,
    description: null,
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

describe("getHiddenProjectIds", () => {
  it("shows project with no tasks", () => {
    const p = idea({ id: "p", type: "project", status: "planned" });
    assert.deepEqual([...getHiddenProjectIds([p], [p])], []);
  });

  it("shows project with only closed tasks", () => {
    const p = idea({ id: "p", type: "project", status: "planned" });
    const t = idea({ id: "t", type: "task", status: "completed", parent_id: "p" });
    // Hide closed On: closed task is not in the pool
    assert.deepEqual([...getHiddenProjectIds([p], [p, t])], []);
  });

  it("hides project with a visible task (any open status)", () => {
    for (const status of ["draft", "planned", "in_progress", "scheduled"] as IdeaStatus[]) {
      const p = idea({ id: "p", type: "project", status: "planned" });
      const t = idea({ id: "t", type: "task", status, parent_id: "p" });
      assert.deepEqual([...getHiddenProjectIds([p, t], [p, t])], ["p"], `status ${status}`);
    }
  });

  it("hides via deep grandchild tasks", () => {
    const p = idea({ id: "p", type: "project", status: "planned" });
    const mid = idea({ id: "m", type: "initiative", status: "completed", parent_id: "p" });
    const t = idea({ id: "t", type: "task", status: "planned", parent_id: "m" });
    // mid is closed so absent from pool, but branch traversal uses all ideas
    assert.deepEqual([...getHiddenProjectIds([p, t], [p, mid, t])], ["p"]);
  });

  it("task outside the pool (e.g. paused under Hide closed) does not hide", () => {
    const p = idea({ id: "p", type: "project", status: "planned" });
    const t = idea({ id: "t", type: "task", status: "paused", parent_id: "p" });
    // pool excludes paused task
    assert.deepEqual([...getHiddenProjectIds([p], [p, t])], []);
    // pool includes paused task (Hide closed Off)
    assert.deepEqual([...getHiddenProjectIds([p, t], [p, t])], ["p"]);
  });

  it("does not hide initiatives or objectives", () => {
    const i = idea({ id: "i", type: "initiative", status: "planned" });
    const t = idea({ id: "t", type: "task", status: "planned", parent_id: "i" });
    assert.deepEqual([...getHiddenProjectIds([i, t], [i, t])], []);
  });

  it("project status is irrelevant", () => {
    const p = idea({ id: "p", type: "project", status: "completed" });
    const t = idea({ id: "t", type: "task", status: "planned", parent_id: "p" });
    assert.deepEqual([...getHiddenProjectIds([p, t], [p, t])], ["p"]);
  });
});

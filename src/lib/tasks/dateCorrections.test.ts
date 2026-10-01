import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeCompletedAtCorrection,
  computeQuickAssignPatch,
  computeRemoveAttemptCorrection,
  computeSetDateCorrection,
} from "./dateCorrections";
import type { Idea } from "@/lib/types";

function baseIdea(): Idea {
  return {
    id: "1",
    user_id: "u",
    parent_id: null,
    text: "t",
    description: null,
    type: "task",
    effort: null,
    impact: null,
    urgency: null,
    scheduled_date: "2026-10-01",
    scheduled_time: null,
    duration_minutes: null,
    is_priority: false,
    priority_order: null,
    status: "scheduled",
    notes: null,
    completed_at: null,
    cancelled_at: null,
    paused_at: null,
    attempt_dates: ["2026-09-29", "2026-09-30"],
    status_history: null,
    in_focus: false,
    in_focus_until: null,
    sort_order: 0,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  };
}

describe("dateCorrections", () => {
  it("set-date leaves attempt_dates identical (no history pollution)", () => {
    assert.deepEqual(computeSetDateCorrection("2026-09-30"), {
      scheduled_date: "2026-09-30",
    });
    assert.deepEqual(computeSetDateCorrection(null), { scheduled_date: null });
  });

  it("remove-attempt drops only the target date", () => {
    const idea = baseIdea();
    assert.deepEqual(computeRemoveAttemptCorrection(idea, "2026-09-30"), {
      attempt_dates: ["2026-09-29"],
    });
    // Unknown date is a no-op (same content).
    assert.deepEqual(computeRemoveAttemptCorrection(idea, "2026-01-01"), {
      attempt_dates: ["2026-09-29", "2026-09-30"],
    });
  });

  it("completed_at set/clear does not flip status", () => {
    assert.deepEqual(computeCompletedAtCorrection("2026-09-30T10:00:00.000Z"), {
      completed_at: "2026-09-30T10:00:00.000Z",
    });
    assert.deepEqual(computeCompletedAtCorrection(null), { completed_at: null });
  });

  it("quick assign defaults past to done-on-that-date, today+ to scheduled", () => {
    const today = "2026-10-01";
    const donePatch = computeQuickAssignPatch("2026-09-30", { today });
    assert.equal(donePatch.scheduled_date, "2026-09-30");
    assert.equal(donePatch.status, "completed");
    assert.ok(donePatch.completed_at?.startsWith("2026-09-30"));
    assert.ok(!("attempt_dates" in donePatch));

    const plannedPatch = computeQuickAssignPatch("2026-10-01", { today });
    assert.deepEqual(plannedPatch, {
      scheduled_date: "2026-10-01",
      status: "scheduled",
      completed_at: null,
      cancelled_at: null,
      paused_at: null,
    });
  });

  it("quick assign respects explicit markDone override", () => {
    const today = "2026-10-01";
    const forcedPlan = computeQuickAssignPatch("2026-09-30", { today, markDone: false });
    assert.equal(forcedPlan.status, "scheduled");
    const forcedDone = computeQuickAssignPatch("2026-10-02", { today, markDone: true });
    assert.equal(forcedDone.status, "completed");
    assert.ok(forcedDone.completed_at?.startsWith("2026-10-02"));
  });
});

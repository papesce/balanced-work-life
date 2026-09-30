import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeClearDatePatch, computeReschedulePatch, willRecordAttempt } from "./rescheduleTask";
import { addDays, getToday } from "../dateUtils";
import type { Idea } from "../types";

function task(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "t1",
    user_id: "u1",
    parent_id: null,
    text: "Test task",
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
    status: "scheduled",
    notes: null,
    completed_at: null,
    cancelled_at: null,
    paused_at: null,
    attempt_dates: [],
    status_history: null,
    in_focus: false,
    in_focus_until: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const today = getToday();
const yesterday = addDays(today, -1);
const tomorrow = addDays(today, 1);
const nextWeek = addDays(today, 7);

describe("willRecordAttempt", () => {
  it("records when the old date is strictly in the past and changes", () => {
    assert.equal(willRecordAttempt(yesterday, today, [], today), true);
  });
  it("does not record when the old date is today", () => {
    assert.equal(willRecordAttempt(today, tomorrow, [], today), false);
  });
  it("does not record future-to-future moves", () => {
    assert.equal(willRecordAttempt(tomorrow, nextWeek, [], today), false);
  });
  it("does not record same-date updates", () => {
    assert.equal(willRecordAttempt(yesterday, yesterday, [], today), false);
  });
  it("does not record when there was no date", () => {
    assert.equal(willRecordAttempt(null, today, [], today), false);
  });
  it("does not duplicate an already recorded date", () => {
    assert.equal(willRecordAttempt(yesterday, today, [yesterday], today), false);
  });
});

describe("computeReschedulePatch", () => {
  it("yesterday -> today records the miss", () => {
    const patch = computeReschedulePatch(task({ scheduled_date: yesterday }), {
      type: "reschedule",
      newDate: today,
    });
    assert.equal(patch.scheduled_date, today);
    assert.deepEqual(patch.attempt_dates, [yesterday]);
    assert.equal(patch.status, "scheduled");
  });

  it("today -> tomorrow does NOT record", () => {
    const patch = computeReschedulePatch(task({ scheduled_date: today }), {
      type: "reschedule",
      newDate: tomorrow,
    });
    assert.equal(patch.scheduled_date, tomorrow);
    assert.deepEqual(patch.attempt_dates, []);
  });

  it("future -> future does NOT record", () => {
    const patch = computeReschedulePatch(task({ scheduled_date: tomorrow }), {
      type: "reschedule",
      newDate: nextWeek,
    });
    assert.deepEqual(patch.attempt_dates, []);
  });

  it("same date + time does NOT record but sets the time", () => {
    const patch = computeReschedulePatch(task({ scheduled_date: today }), {
      type: "reschedule",
      newDate: today,
      time: "09:00",
    });
    assert.deepEqual(patch.attempt_dates, []);
    assert.equal(patch.scheduled_time, "09:00");
  });

  it("leaves scheduled_time untouched when no time is given", () => {
    const patch = computeReschedulePatch(
      task({ scheduled_date: yesterday, scheduled_time: "08:00" }),
      { type: "reschedule", newDate: today },
    );
    assert.ok(!("scheduled_time" in patch));
  });

  it("explicit recordAttempt:true overrides the default", () => {
    const patch = computeReschedulePatch(task({ scheduled_date: today }), {
      type: "reschedule",
      newDate: tomorrow,
      recordAttempt: true,
    });
    assert.deepEqual(patch.attempt_dates, [today]);
  });

  it("explicit recordAttempt:false overrides the default", () => {
    const patch = computeReschedulePatch(task({ scheduled_date: yesterday }), {
      type: "reschedule",
      newDate: today,
      recordAttempt: false,
    });
    assert.deepEqual(patch.attempt_dates, []);
  });

  it("clears completed/cancelled/paused timestamps", () => {
    const patch = computeReschedulePatch(
      task({ scheduled_date: yesterday, completed_at: "x", paused_at: "y" }),
      { type: "reschedule", newDate: today },
    );
    assert.equal(patch.completed_at, null);
    assert.equal(patch.cancelled_at, null);
    assert.equal(patch.paused_at, null);
  });

  it("undo patch restores scheduled_date and attempt_dates", () => {
    const before = task({ scheduled_date: yesterday, attempt_dates: [] });
    const patch = computeReschedulePatch(before, { type: "reschedule", newDate: today });
    const undo = { scheduled_date: before.scheduled_date, attempt_dates: before.attempt_dates };
    const restored = { ...before, ...patch, ...undo };
    assert.equal(restored.scheduled_date, yesterday);
    assert.deepEqual(restored.attempt_dates, []);
  });
});

describe("computeClearDatePatch", () => {
  it("records only when the old date is strictly in the past", () => {
    assert.deepEqual(computeClearDatePatch(task({ scheduled_date: yesterday })).attempt_dates, [
      yesterday,
    ]);
    assert.deepEqual(computeClearDatePatch(task({ scheduled_date: today })).attempt_dates, []);
  });
});

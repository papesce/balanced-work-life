import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  QUICK_NOTE_ALERT_AT,
  QUICK_NOTE_NOTES_WARN_AT,
  QUICK_NOTE_WARN_AT,
  quickNoteBacklogLevel,
} from "@/lib/quicknote/backlog";

describe("quickNoteBacklogLevel", () => {
  it("thresholds are 5 tasks (yellow), 10 tasks (red), 6+ notes (yellow)", () => {
    assert.equal(QUICK_NOTE_WARN_AT, 5);
    assert.equal(QUICK_NOTE_ALERT_AT, 10);
    assert.equal(QUICK_NOTE_NOTES_WARN_AT, 5);
  });

  it("is normal below 5 tasks with few notes", () => {
    for (const n of [0, 1, 4]) assert.equal(quickNoteBacklogLevel(n), "normal", `${n}`);
    assert.equal(quickNoteBacklogLevel(0, 5), "normal");
  });

  it("is warning from 5 up to 9", () => {
    for (const n of [5, 7, 9]) assert.equal(quickNoteBacklogLevel(n), "warning", `${n}`);
  });

  it("is alert at 10 and above", () => {
    for (const n of [10, 15, 20, 99]) assert.equal(quickNoteBacklogLevel(n), "alert", `${n}`);
  });

  it("warns on more than 5 open notes even with few tasks", () => {
    assert.equal(quickNoteBacklogLevel(0, 6), "warning");
    assert.equal(quickNoteBacklogLevel(3, 8), "warning");
  });

  it("tasks still drive red regardless of note count", () => {
    assert.equal(quickNoteBacklogLevel(12, 2), "alert");
    assert.equal(quickNoteBacklogLevel(12, 9), "alert");
  });
});

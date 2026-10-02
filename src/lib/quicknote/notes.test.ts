import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { QuickNote } from "@/lib/types";
import { reuseIfIdentical, sameQuickNoteRow, stabilizeNoteRows } from "./notes";

function row(overrides: Partial<QuickNote> = {}): QuickNote {
  return {
    id: "note-1",
    user_id: "user-1",
    text: "hello",
    status: "open",
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("note identity stabilization", () => {
  it("treats field-identical rows as the same", () => {
    assert.equal(sameQuickNoteRow(row(), { ...row() }), true);
  });

  it("detects a text change as a different row", () => {
    assert.equal(sameQuickNoteRow(row(), row({ text: "hello!" })), false);
  });

  it("detects status/archival changes as different rows", () => {
    assert.equal(sameQuickNoteRow(row(), row({ status: "archived" })), false);
    assert.equal(sameQuickNoteRow(row(), row({ archived_at: "2026-10-01T01:00:00.000Z" })), false);
  });

  it("reuses the cached object when a query re-emits identical rows", () => {
    const cache = new Map<string, QuickNote>();
    const first = stabilizeNoteRows([row(), row({ id: "note-2" })], cache);
    // Fresh objects, field-identical (as PowerSync re-emissions are).
    const second = stabilizeNoteRows([{ ...first[0] }, { ...first[1] }], cache);
    assert.equal(second[0] === first[0], true);
    assert.equal(second[1] === first[1], true);
  });

  it("mints a new object only for the row that actually changed", () => {
    const cache = new Map<string, QuickNote>();
    const first = stabilizeNoteRows([row(), row({ id: "note-2", text: "other" })], cache);
    const second = stabilizeNoteRows([{ ...first[0] }, { ...first[1], text: "other!" }], cache);
    assert.equal(second[0] === first[0], true);
    assert.equal(second[1] === first[1], false);
    assert.equal(second[1].text, "other!");
  });

  it("prunes ids that left the result set so the cache cannot leak", () => {
    const cache = new Map<string, QuickNote>();
    stabilizeNoteRows([row(), row({ id: "note-2" })], cache);
    assert.equal(cache.size, 2);
    stabilizeNoteRows([{ ...row() }], cache);
    assert.equal(cache.size, 1);
    assert.ok(cache.has("note-1"));
  });

  it("reuses the previous array when it holds the same objects in order", () => {
    const prev = [row(), row({ id: "note-2" })];
    assert.equal(reuseIfIdentical(prev, [...prev]), prev);
  });

  it("returns a new array when order changes or objects differ", () => {
    const prev = [row(), row({ id: "note-2" })];
    const reordered = [prev[1], prev[0]];
    assert.equal(reuseIfIdentical(prev, reordered) === prev, false);
    const replaced = [{ ...prev[0] }, prev[1]];
    assert.equal(reuseIfIdentical(prev, replaced) === prev, false);
    assert.equal(reuseIfIdentical(prev, [prev[0]]) === prev, false);
  });
});

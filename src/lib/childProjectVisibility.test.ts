import { test } from "node:test";
import assert from "node:assert/strict";
import { getHiddenChildProjectIds } from "./childProjectVisibility";
import type { Idea } from "@/lib/types";

function idea(
  id: string,
  type: "project" | "task" = "project",
  parent_id: string | null = null,
): Idea {
  return {
    id,
    type,
    parent_id,
    text: id,
    status: "open",
    updated_at: "2026-01-01",
  } as unknown as Idea;
}

test("root project not hidden", () => {
  const pool = [idea("p")];
  const hidden = getHiddenChildProjectIds(pool, pool);
  assert.equal(hidden.size, 0);
});

test("child whose parent visible hidden", () => {
  const parent = idea("p");
  const child = idea("c", "project", "p");
  const all = [parent, child];
  const hidden = getHiddenChildProjectIds(all, all);
  assert.deepEqual([...hidden], ["c"]);
});

test("child whose parent hidden shown", () => {
  const parent = idea("p");
  const child = idea("c", "project", "p");
  const all = [parent, child];
  // parent not in pool
  const hidden = getHiddenChildProjectIds([child], all);
  assert.equal(hidden.size, 0);
});

test("non-project parent not hidden", () => {
  const parent = idea("p", "task");
  const child = idea("c", "project", "p");
  const all = [parent, child];
  const hidden = getHiddenChildProjectIds(all, all);
  assert.equal(hidden.size, 0);
});

test("deep chain one level only", () => {
  const a = idea("a");
  const b = idea("b", "project", "a");
  const c = idea("c", "project", "b");
  const all = [a, b, c];
  const hidden = getHiddenChildProjectIds(all, all);
  assert.deepEqual([...hidden].sort(), ["b"]);
});

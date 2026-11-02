import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildIdeaTree,
  buildScopedQuery,
  computeCollapsedIds,
  DEFAULT_EXPAND_DEPTH,
} from "@/lib/ideaModel";
import type { Idea, IdeaType } from "@/lib/types";

type Override = "expanded" | "collapsed";

function idea(overrides: Partial<Idea>): Idea {
  return {
    id: "x",
    user_id: "user-1",
    parent_id: null,
    series_id: null,
    text: "",
    description: null,
    type: "idea" as IdeaType,
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
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// Tree shape (depth):
//   root          (depth 0, parent of child + path)
//   ├─ child      (depth 1, parent of grandchild + pathDeep)
//   │  ├─ grand   (depth 2, leaf)
//   │  └─ pathDeep (depth 2, path)
//   └─ path       (depth 1, path)
const root = idea({ id: "root", parent_id: null, type: "idea" });
const child = idea({ id: "child", parent_id: "root", type: "idea" });
const grandchild = idea({ id: "grand", parent_id: "child", type: "idea" });
const path = idea({ id: "path", parent_id: "root", type: "path" });
const pathDeep = idea({ id: "pathDeep", parent_id: "child", type: "path" });
const base = [root, child, grandchild, path, pathDeep];

describe("computeCollapsedIds", () => {
  it("collapses a non-path parent at depth >= DEFAULT_EXPAND_DEPTH by default", () => {
    assert.equal(DEFAULT_EXPAND_DEPTH, 1);
    const collapsed = computeCollapsedIds(base, new Map());
    assert.equal(collapsed.has("child"), true, "deep parent collapsed by default");
    assert.equal(collapsed.has("root"), false, "depth-0 parent not collapsed by default");
  });

  describe("buildScopedQuery event handling", () => {
    it("excludes events by default and includes them only when requested", () => {
      const defaultQuery = buildScopedQuery("user-1", "all");
      const includeEventsQuery = buildScopedQuery("user-1", "all", { includeEvents: true });
      assert.match(defaultQuery.sql, /type IS NULL OR type <> 'event'/);
      assert.doesNotMatch(includeEventsQuery.sql, /type <> 'event'/);
    });
  });

  describe("buildIdeaTree event handling", () => {
    it("never adds events to the brainstorm tree", () => {
      const event = idea({ id: "event", type: "event", status: "not_applicable" });
      assert.deepEqual(
        buildIdeaTree([root, event], new Set()).map((node) => node.id),
        ["root"],
      );
    });
  });

  it("leaves paths expanded by default when there is no override", () => {
    const collapsed = computeCollapsedIds(base, new Map());
    assert.equal(collapsed.has("path"), false, "path defaults to expanded");
    assert.equal(collapsed.has("pathDeep"), false, "deep path defaults to expanded");
  });

  it("collapses a path when its override is 'collapsed'", () => {
    const collapsed = computeCollapsedIds(
      base,
      new Map([["path", "collapsed"]]) as Map<string, Override>,
    );
    assert.equal(collapsed.has("path"), true, "collapsed override collapses the path");
    assert.equal(collapsed.has("pathDeep"), false, "other path stays expanded");
  });

  it("keeps a path expanded when its override is 'expanded'", () => {
    const collapsed = computeCollapsedIds(
      base,
      new Map([["path", "expanded"]]) as Map<string, Override>,
    );
    assert.equal(collapsed.has("path"), false, "explicit expanded override keeps it visible");
  });

  it("does not collapse a path via the depth rule even when deeply nested", () => {
    // pathDeep sits at depth 2 (>= DEFAULT_EXPAND_DEPTH); the depth rule is
    // parent-only and must not accidentally hide its mini plan.
    const collapsed = computeCollapsedIds(base, new Map());
    assert.equal(collapsed.has("pathDeep"), false, "deep path not collapsed by depth");
  });

  it("still respects an 'expanded' override for a deep parent", () => {
    const collapsed = computeCollapsedIds(
      base,
      new Map([["child", "expanded"]]) as Map<string, Override>,
    );
    assert.equal(collapsed.has("child"), false, "expanded parent override wins");
  });

  it("keeps a parent expanded when it matches the active search", () => {
    const childText = idea({ ...child, text: "search me" });
    const collapsed = computeCollapsedIds(
      [root, childText, grandchild, path, pathDeep],
      new Map(),
      "search",
    );
    assert.equal(collapsed.has("child"), false, "search match keeps parent expanded");
  });
});

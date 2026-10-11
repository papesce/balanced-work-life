import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPathMembership,
  dedupePathItems,
  deserializePath,
  deserializePathItem,
  findPathItemByIdea,
  isReady,
  nextPathSortOrder,
  pathEndpoints,
  pathProgress,
  sortPaths,
  type Path,
  wouldCreateCycle,
} from "@/lib/paths";
import type { Idea, IdeaLink } from "@/lib/types";

function path(overrides: Partial<Path> & { id: string }): Path {
  return {
    user_id: "u",
    project_id: "p",
    title: "t",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("sortPaths", () => {
  it("orders by sort_order, then created_at, then id", () => {
    const b = path({ id: "b", sort_order: 0, created_at: "2026-01-02T00:00:00.000Z" });
    const a = path({ id: "a", sort_order: 0, created_at: "2026-01-01T00:00:00.000Z" });
    const c = path({ id: "c", sort_order: 1, created_at: "2026-01-01T00:00:00.000Z" });
    assert.deepEqual(
      sortPaths([c, b, a]).map((p) => p.id),
      ["a", "b", "c"],
    );
  });
});

describe("nextPathSortOrder", () => {
  it("returns 0 for an empty list and max+1 otherwise", () => {
    assert.equal(nextPathSortOrder([]), 0);
    assert.equal(nextPathSortOrder([{ sort_order: 0 }, { sort_order: 4 }]), 5);
  });
});

describe("findPathItemByIdea / dedupePathItems", () => {
  it("finds the index of a member idea", () => {
    assert.equal(findPathItemByIdea([{ idea_id: "a" }, { idea_id: "b" }], "b"), 1);
    assert.equal(findPathItemByIdea([{ idea_id: "a" }], "zzz"), -1);
  });

  it("keeps the first occurrence per idea_id", () => {
    const items = [
      { idea_id: "a", n: 1 },
      { idea_id: "b", n: 2 },
      { idea_id: "a", n: 3 },
    ];
    assert.deepEqual(dedupePathItems(items), [
      { idea_id: "a", n: 1 },
      { idea_id: "b", n: 2 },
    ]);
  });
});

describe("deserializePath / deserializePathItem", () => {
  it("coerces numeric columns stored as text", () => {
    assert.equal(deserializePath({ sort_order: "3" }).sort_order, 3);
    const item = deserializePathItem({ x: "12.5", y: null });
    assert.equal(item.x, 12.5);
    assert.equal(item.y, 0);
  });

  it("falls back for non-numeric values", () => {
    assert.equal(deserializePath({ sort_order: "abc" }).sort_order, 0);
    assert.equal(deserializePathItem({ x: "abc", y: "abc" }).x, 0);
  });
});

describe("buildPathMembership", () => {
  it("groups sorted path titles per task and skips bad rows", () => {
    const rows = [
      { idea_id: "a", path_id: "p2", title: "Beta" },
      { idea_id: "a", path_id: "p1", title: "Alpha" },
      { idea_id: "b", path_id: "p1", title: "Alpha" },
      { idea_id: "", path_id: "p1", title: "Alpha" },
    ];
    assert.deepEqual(
      buildPathMembership(rows),
      new Map([
        ["a", ["Alpha", "Beta"]],
        ["b", ["Alpha"]],
      ]),
    );
  });

  it("falls back to Untitled path for blank titles", () => {
    assert.deepEqual(
      buildPathMembership([{ idea_id: "a", path_id: "p", title: "" }]),
      new Map([["a", ["Untitled path"]]]),
    );
  });
});
describe("wouldCreateCycle", () => {
  it("rejects self-links and closing an existing chain", () => {
    assert.equal(wouldCreateCycle([], "a", "a"), true);
    const edges = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "c" },
    ];
    assert.equal(wouldCreateCycle(edges, "c", "a"), true);
    assert.equal(wouldCreateCycle(edges, "a", "c"), false);
  });
});
function statusById(entries: [string, Idea["status"]][]): Map<string, { status: Idea["status"] }> {
  return new Map(entries.map(([id, status]) => [id, { status }]));
}

function dependsOn(
  source_id: string,
  target_id: string,
): Pick<IdeaLink, "source_id" | "target_id" | "link_type"> {
  return { source_id, target_id, link_type: "depends_on" };
}

describe("isReady", () => {
  it("is ready with no prerequisites when not terminal", () => {
    assert.equal(isReady({ id: "a", status: "draft" }, [], statusById([])), true);
  });

  it("is not ready when terminal, even with no prerequisites", () => {
    for (const status of ["completed", "cancelled", "missed", "archived"] as Idea["status"][]) {
      assert.equal(isReady({ id: "a", status }, [], statusById([])), false);
    }
  });

  it("requires every depends_on prerequisite to be completed or cancelled", () => {
    const links = [dependsOn("a", "b"), dependsOn("a", "c")];
    assert.equal(
      isReady(
        { id: "a", status: "planned" },
        links,
        statusById([
          ["b", "completed"],
          ["c", "cancelled"],
        ]),
      ),
      true,
    );
    assert.equal(
      isReady(
        { id: "a", status: "planned" },
        links,
        statusById([
          ["b", "completed"],
          ["c", "in_progress"],
        ]),
      ),
      false,
    );
  });

  it("treats a missing prerequisite task as unsatisfied and ignores other link types", () => {
    assert.equal(
      isReady({ id: "a", status: "draft" }, [dependsOn("a", "ghost")], statusById([])),
      false,
    );
    assert.equal(
      isReady(
        { id: "a", status: "draft" },
        [{ source_id: "a", target_id: "b", link_type: "related_to" }],
        statusById([["b", "draft"]]),
      ),
      true,
    );
  });
});

describe("pathProgress", () => {
  it("counts completed and cancelled as done and skips unknown tasks", () => {
    const items = [{ idea_id: "a" }, { idea_id: "b" }, { idea_id: "c" }, { idea_id: "ghost" }];
    const byId = statusById([
      ["a", "completed"],
      ["b", "cancelled"],
      ["c", "in_progress"],
    ]);
    assert.deepEqual(pathProgress(items, byId), { done: 2, total: 3 });
  });

  it("dedupes repeated members", () => {
    const byId = statusById([["a", "completed"]]);
    assert.deepEqual(pathProgress([{ idea_id: "a" }, { idea_id: "a" }], byId), {
      done: 1,
      total: 1,
    });
  });
});

describe("pathEndpoints", () => {
  it("returns members nothing else in the path depends on", () => {
    // b depends on a, c depends on b → only c is an endpoint.
    const items = [{ idea_id: "a" }, { idea_id: "b" }, { idea_id: "c" }];
    const links = [dependsOn("b", "a"), dependsOn("c", "b")];
    assert.deepEqual(pathEndpoints(items, links), ["c"]);
  });

  it("ignores links to tasks outside the path and non-depends_on links", () => {
    const items = [{ idea_id: "a" }, { idea_id: "b" }];
    const links = [
      dependsOn("a", "outside"),
      { source_id: "a", target_id: "b", link_type: "related_to" as const },
    ];
    assert.deepEqual(pathEndpoints(items, links), ["a", "b"]);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert";
import { computePathLayout } from "./pathLayout";
import type { PathItem, PathEdge } from "./paths";

describe("computePathLayout", () => {
  it("handles empty items", () => {
    const layout = computePathLayout([], []);
    assert.strictEqual(layout.nodes.length, 0);
    assert.strictEqual(layout.edges.length, 0);
  });

  it("lays out nodes left to right", () => {
    const items: PathItem[] = [
      {
        id: "1",
        user_id: "u1",
        path_id: "p1",
        title: "Step 1",
        idea_id: null,
        x: 0,
        y: 0,
        created_at: "",
      },
      {
        id: "2",
        user_id: "u1",
        path_id: "p1",
        title: "Step 2",
        idea_id: "task-2",
        x: 0,
        y: 0,
        created_at: "",
      },
    ];
    const edges: PathEdge[] = [
      {
        id: "e1",
        user_id: "u1",
        path_id: "p1",
        from_item_id: "1",
        to_item_id: "2",
        created_at: "",
      },
    ];
    const promoted = { "task-2": "completed" };

    const layout = computePathLayout(items, edges, promoted);
    assert.strictEqual(layout.nodes.length, 2);
    assert.strictEqual(layout.edges.length, 1);

    const node1 = layout.nodes.find((n) => n.id === "1");
    const node2 = layout.nodes.find((n) => n.id === "2");
    assert.ok(node1);
    assert.ok(node2);
    assert.strictEqual(node1.status, "placeholder");
    assert.strictEqual(node2.status, "completed");
    // Left-to-right means node 1 has smaller x than node 2
    assert.ok(node1.x < node2.x, `node1.x (${node1.x}) should be < node2.x (${node2.x})`);
  });
});

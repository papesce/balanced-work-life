/* eslint-disable @typescript-eslint/no-explicit-any -- lightweight PowerSync transaction mock */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { v4 as uuidv4 } from "uuid";
import { deserializePath, deserializePathItem, isPathStepComplete } from "./paths";

describe("deserializePath", () => {
  it("preserves path notes and defaults older rows without notes to null", () => {
    assert.strictEqual(
      deserializePath({ id: "path-1", notes: "Consider alternatives" }).notes,
      "Consider alternatives",
    );
    assert.strictEqual(deserializePath({ id: "path-2" }).notes, null);
  });
});

describe("deserializePathItem", () => {
  it("preserves a step note and defaults older rows without one to null", () => {
    assert.strictEqual(
      deserializePathItem({ id: "step-1", notes: "Bring measurements" }).notes,
      "Bring measurements",
    );
    assert.strictEqual(deserializePathItem({ id: "step-2" }).notes, null);
  });
});

describe("isPathStepComplete", () => {
  it("uses the manual timestamp for a plan-only step", () => {
    assert.strictEqual(isPathStepComplete(null, null), false);
    assert.strictEqual(isPathStepComplete("2026-10-27T12:00:00Z", null), true);
  });

  it("derives linked-step completion from the task status", () => {
    assert.strictEqual(isPathStepComplete(null, "planned"), false);
    assert.strictEqual(isPathStepComplete(null, "completed"), true);
  });
});

// Mock PowerSync DB
const createMockDb = () => {
  const tables = {
    ideas: new Map<string, any>(),
    path_items: new Map<string, any>(),
    path_edges: new Map<string, any>(),
    idea_links: new Map<string, any>(),
  };

  return {
    execute: async (sql: string, params: any[]) => {
      if (sql.includes("INSERT INTO ideas")) {
        const [id, userId, text, type, status] = params;
        tables.ideas.set(id, { id, user_id: userId, text, type, status });
      } else if (sql.includes("UPDATE path_items SET idea_id")) {
        const [ideaId, itemId] = params;
        const item = tables.path_items.get(itemId);
        if (item) tables.path_items.set(itemId, { ...item, idea_id: ideaId });
      } else if (sql.includes("INSERT INTO idea_links")) {
        const [id, , source, target, type] = params;
        tables.idea_links.set(id, { id, source_id: source, target_id: target, link_type: type });
      } else if (sql.includes("UPDATE path_items SET idea_id")) {
        const [ideaId, itemId] = params;
        const item = tables.path_items.get(itemId);
        if (item) tables.path_items.set(itemId, { ...item, idea_id: ideaId });
      }
      return { rowsAffected: 1 };
    },
    getOptional: async (sql: string, params: any[]) => {
      if (sql.includes("FROM path_items WHERE id = ?")) {
        const id = params[0];
        const item = tables.path_items.get(id);
        return item ? { idea_id: item.idea_id } : null;
      }
      return null;
    },
    getAll: async (sql: string, params: any[]) => {
      if (sql.includes("FROM path_edges")) {
        const [path, from, to] = params;
        return Array.from(tables.path_edges.values()).filter(
          (e) => e.path_id === path && (e.from_item_id === from || e.to_item_id === to),
        );
      }
      return [];
    },
    writeTransaction: async (fn: any) => {
      return await fn({
        execute: (sql: string, params: any[]) => {
          // Simple routing to existing execute logic
          if (sql.includes("INSERT INTO ideas")) {
            const [id, userId, text, type, status] = params;
            tables.ideas.set(id, { id, userId, text, type, status });
          } else if (sql.includes("UPDATE path_items SET idea_id")) {
            const [ideaId, itemId] = params;
            const item = tables.path_items.get(itemId);
            if (item) tables.path_items.set(itemId, { ...item, idea_id: ideaId });
          } else if (sql.includes("INSERT INTO idea_links")) {
            const [id, , source, target, type] = params;
            tables.idea_links.set(id, {
              id,
              source_id: source,
              target_id: target,
              link_type: type,
            });
          }
        },
        getOptional: async (sql: string, params: any[]) => {
          if (sql.includes("FROM path_items WHERE id = ?")) {
            const id = params[0];
            const item = tables.path_items.get(id);
            return item ? { idea_id: item.idea_id } : null;
          }
          return null;
        },
        getAll: async (sql: string, params: any[]) => {
          if (sql.includes("FROM path_edges")) {
            const [path, from, to] = params;
            return Array.from(tables.path_edges.values()).filter(
              (e) => e.path_id === path && (e.from_item_id === from || e.to_item_id === to),
            );
          }
          return [];
        },
      });
    },
    tables, // Exported for test verification
  };
};

describe("Path Promotion Logic", () => {
  let db: any;
  const userId = "user-1";
  const pathId = "path-1";

  beforeEach(() => {
    db = createMockDb();
  });

  it("should create an idea and link it to the node upon promotion", async () => {
    const itemId = "item-1";
    db.tables.path_items.set(itemId, { id: itemId, idea_id: null });

    // We simulate the promoteNode logic manually since the hook is a React hook
    // In a real test we'd use a library like @testing-library/react-hooks
    // but for domain logic we can test the transaction pattern.

    const taskId = uuidv4();
    await db.execute(`INSERT INTO ideas ...`, [taskId, userId, "Task 1", "task", "open"]);
    await db.execute(`UPDATE path_items SET idea_id = ? WHERE id = ?`, [taskId, itemId]);

    assert.strictEqual(db.tables.ideas.has(taskId), true);
    assert.strictEqual(db.tables.path_items.get(itemId).idea_id, taskId);
  });

  it("should materialize idea_links only when both ends are promoted", async () => {
    const itemA = "item-a";
    const itemB = "item-b";
    db.tables.path_items.set(itemA, { id: itemA, idea_id: null });
    db.tables.path_items.set(itemB, { id: itemB, idea_id: null });
    db.tables.path_edges.set("edge-1", {
      id: "edge-1",
      path_id: pathId,
      from_item_id: itemA,
      to_item_id: itemB,
    });

    // Promote A
    const taskA = uuidv4();
    await db.execute(`UPDATE path_items SET idea_id = ? WHERE id = ?`, [taskA, itemA]);

    // Verify no idea_link yet
    assert.strictEqual(db.tables.idea_links.size, 0);

    // Promote B
    const taskB = uuidv4();
    await db.execute(`UPDATE path_items SET idea_id = ? WHERE id = ?`, [taskB, itemB]);

    // Manual check of the materialize logic used in usePathManager
    const edges = await db.getAll(
      `SELECT * FROM path_edges WHERE path_id = ? AND (from_item_id = ? OR to_item_id = ?)`,
      [pathId, itemB, itemB],
    );
    for (const edge of edges) {
      const fromItem = await db.getOptional(`SELECT idea_id FROM path_items WHERE id = ?`, [
        edge.from_item_id,
      ]);
      const toItem = await db.getOptional(`SELECT idea_id FROM path_items WHERE id = ?`, [
        edge.to_item_id,
      ]);
      if (fromItem?.idea_id && toItem?.idea_id) {
        await db.execute(
          `INSERT INTO idea_links (id, user_id, source_id, target_id, link_type) VALUES (?,?,?,?,?)`,
          [uuidv4(), userId, fromItem.idea_id, toItem.idea_id, "depends_on"],
        );
      }
    }

    assert.strictEqual(db.tables.idea_links.size, 1);
    const link = Array.from(db.tables.idea_links.values())[0] as {
      source_id: string;
      target_id: string;
    };
    assert.strictEqual(link.source_id, taskA);
    assert.strictEqual(link.target_id, taskB);
  });
});

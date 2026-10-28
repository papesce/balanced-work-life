import { describe, it } from "node:test";
import assert from "node:assert";
import type { Idea, IdeaNode, IdeaType } from "@/lib/types";
import { filterIdeaTree } from "./ideaTreeFilters";

function makeIdea(id: string, type: IdeaType, parent_id: string | null = null): Idea {
  return {
    id,
    user_id: "user-1",
    parent_id,
    text: id,
    description: null,
    type,
    effort: null,
    impact: null,
    urgency: null,
    scheduled_date: null,
    scheduled_time: null,
    duration_minutes: null,
    is_priority: false,
    priority_order: null,
    status: "draft",
    notes: null,
    why: null,
    completed_at: null,
    cancelled_at: null,
    paused_at: null,
    attempt_dates: [],
    status_history: null,
    sort_order: 0,
    created_at: "",
    updated_at: "",
  };
}

describe("filterIdeaTree", () => {
  it("applies a type filter without search or other filters", () => {
    const task = makeIdea("task", "task", "project");
    const sibling = makeIdea("sibling", "idea", "project");
    const project = makeIdea("project", "project");
    const tree: IdeaNode[] = [
      {
        ...project,
        children: [
          { ...task, children: [], collapsed: false },
          { ...sibling, children: [], collapsed: false },
        ],
        collapsed: false,
      },
    ];

    const filtered = filterIdeaTree(tree, [project, task, sibling], { typeFilter: ["task"] });

    assert.deepStrictEqual(
      filtered.map((node) => node.id),
      ["project"],
    );
    assert.deepStrictEqual(
      filtered[0].children.map((node) => node.id),
      ["task"],
    );
  });
});

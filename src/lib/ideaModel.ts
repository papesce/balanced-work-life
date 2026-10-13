import { buildTree as buildTreeGeneric } from "@/components/tree/buildTree";
import { getToday, getWindowRange } from "@/lib/dateUtils";
import type { Idea, IdeaNode } from "@/lib/types";
import type { IdeasScope } from "@/hooks/useIdeas";

export const DEFAULT_EXPAND_DEPTH = 1;

export function getDepthMap(ideas: Idea[]): Map<string, number> {
  const depths = new Map<string, number>();
  const childrenOf = new Map<string | null, string[]>();
  for (const idea of ideas) {
    const parentKey = idea.parent_id ?? null;
    if (!childrenOf.has(parentKey)) childrenOf.set(parentKey, []);
    childrenOf.get(parentKey)!.push(idea.id);
  }
  const walk = (id: string, depth: number) => {
    depths.set(id, depth);
    for (const childId of childrenOf.get(id) ?? []) walk(childId, depth + 1);
  };
  for (const rootId of childrenOf.get(null) ?? []) walk(rootId, 0);
  return depths;
}

export function computeCollapsedIds(
  ideas: Idea[],
  overrides: Map<string, "expanded" | "collapsed">,
  search = "",
): Set<string> {
  const depths = getDepthMap(ideas);
  const collapsed = new Set<string>();
  const parents = new Set(
    ideas.filter((i) => ideas.some((c) => c.parent_id === i.id)).map((i) => i.id),
  );
  const hasSearch = search.trim().length > 0;

  const nodeHasSearchMatch = (ideaId: string): boolean => {
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) return false;
    const q = search.toLowerCase();
    if (idea.text.toLowerCase().includes(q)) return true;
    if (idea.notes?.toLowerCase().includes(q)) return true;
    if (idea.why?.toLowerCase().includes(q)) return true;
    return ideas.some((child) => child.parent_id === ideaId && nodeHasSearchMatch(child.id));
  };

  for (const id of parents) {
    const depth = depths.get(id) ?? 0;
    const override = overrides.get(id);
    if (override === "expanded") continue;
    if (hasSearch && nodeHasSearchMatch(id)) continue;
    if (override === "collapsed" || depth >= DEFAULT_EXPAND_DEPTH) {
      collapsed.add(id);
    }
  }
  return collapsed;
}

export function compareIdeasForTree(a: Idea, b: Idea): number {
  const aDone = a.completed_at || a.status === "missed" ? 1 : 0;
  const bDone = b.completed_at || b.status === "missed" ? 1 : 0;
  if (aDone !== bDone) return aDone - bDone;
  return a.sort_order - b.sort_order;
}

export function buildIdeaTree(ideas: Idea[], collapsedIds: Set<string>): IdeaNode[] {
  return buildTreeGeneric(ideas, collapsedIds, compareIdeasForTree);
}

export function sortIdeasForInsert(ideas: Idea[]): Idea[] {
  const byId = new Map(ideas.map((idea) => [idea.id, idea]));
  const depthOf = (idea: Idea): number => {
    let depth = 0;
    let current = idea;
    while (current.parent_id && byId.has(current.parent_id)) {
      depth += 1;
      current = byId.get(current.parent_id)!;
    }
    return depth;
  };

  return [...ideas].sort((a, b) => depthOf(a) - depthOf(b));
}

/** PowerSync stores JSON columns as text — deserialize them back to the expected JS types. */
function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    let parsed: unknown = JSON.parse(value);
    // Unwrap double-encoding from legacy uploads that stored a JSON string
    // ('"[\\"2026-..\\"]"') instead of an array in the server jsonb column.
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return [];
      }
    }
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function parseStatusHistory(value: unknown): { status: Idea["status"]; at: string }[] | null {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) return value as { status: Idea["status"]; at: string }[];
  if (typeof value !== "string") return null;
  try {
    let parsed: unknown = JSON.parse(value);
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return null;
      }
    }
    return Array.isArray(parsed) ? (parsed as { status: Idea["status"]; at: string }[]) : null;
  } catch {
    return null;
  }
}

export function deserializeIdea(row: Record<string, unknown>): Idea {
  return {
    ...row,
    why: (row.why as string | null) ?? null,
    is_priority: Boolean(row.is_priority),
    attempt_dates: parseStringArray(row.attempt_dates),
    status_history: parseStatusHistory(row.status_history),
  } as unknown as Idea;
}

export function buildScopedQuery(
  userId: string,
  scope: IdeasScope,
): { sql: string; params: string[] } {
  if (scope === "this_month") {
    const { start, end } = getWindowRange("month", getToday());
    return {
      sql: `SELECT * FROM ideas WHERE user_id = ?
            AND (
              (scheduled_date >= ? AND scheduled_date <= ?)
              OR (scheduled_date IS NULL AND status NOT IN ('completed','cancelled','missed','archived'))
            )
            ORDER BY sort_order ASC`,
      params: [userId, start, end],
    };
  }
  return {
    sql: `SELECT * FROM ideas WHERE user_id = ? ORDER BY sort_order ASC`,
    params: [userId],
  };
}

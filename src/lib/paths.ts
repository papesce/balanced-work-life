import type { Idea, IdeaLink } from "@/lib/types";

/**
 * Mirror of TERMINAL_STATUSES in lib/constants. Kept as a local literal so
 * this pure module stays free of UI dependencies (constants pulls in
 * lucide-react) and loads under node:test, where constants' value-import
 * of types fails. Update together with TERMINAL_STATUSES.
 */
const TERMINAL_STATUSES: readonly string[] = ["completed", "cancelled", "missed", "archived"];

export interface Path {
  id: string;
  user_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  type: string;
  status: string;
}

export interface PathItem {
  id: string;
  user_id: string;
  path_id: string;
  title: string;
  idea_id: string | null;
  x: number;
  y: number;
  created_at: string;
}

export interface PathEdge {
  id: string;
  user_id: string;
  path_id: string;
  from_item_id: string;
  to_item_id: string;
  created_at: string;
}

export interface PathPosition {
  itemId: string;
  x: number;
  y: number;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

export function deserializePath(row: Record<string, unknown>): Path {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    title: typeof row.text === "string" ? row.text : typeof row.title === "string" ? row.title : "",
    sort_order: toNumber(row.sort_order, 0),
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    type: String(row.type ?? "path"),
    status: String(row.status ?? "open"),
  };
}

export function deserializePathItem(row: Record<string, unknown>): PathItem {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    path_id: String(row.path_id ?? ""),
    title: typeof row.title === "string" ? row.title : "",
    idea_id: row.idea_id ? String(row.idea_id) : null,
    x: toNumber(row.x, 0),
    y: toNumber(row.y, 0),
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export function deserializePathEdge(row: Record<string, unknown>): PathEdge {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    path_id: String(row.path_id ?? ""),
    from_item_id: String(row.from_item_id ?? ""),
    to_item_id: String(row.to_item_id ?? ""),
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

/** Paths ordered for display: sort_order, then created_at, then id. */
export function sortPaths(paths: Path[]): Path[] {
  return [...paths].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  );
}

export function nextPathSortOrder(paths: Pick<Path, "sort_order">[]): number {
  if (paths.length === 0) return 0;
  return Math.max(...paths.map((p) => p.sort_order)) + 1;
}

export function findPathItemByIdea(items: Pick<PathItem, "idea_id">[], ideaId: string): number {
  return items.findIndex((item) => item.idea_id === ideaId);
}

/**
 * Dedupe items by idea_id, keeping the first occurrence.
 * The DB enforces UNIQUE(path_id, idea_id); this mirrors that invariant
 * for in-memory lists (e.g. converging rows from two devices).
 */
export function dedupePathItems<T extends Pick<PathItem, "idea_id">>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (item.idea_id === null || seen.has(item.idea_id)) continue;
    seen.add(item.idea_id);
    out.push(item);
  }
  return out;
}

type TaskRef = Pick<Idea, "id" | "status">;
type LinkRef = Pick<IdeaLink, "source_id" | "target_id" | "link_type">;
type StatusLookup = Map<string, Pick<Idea, "status">>;

/** A prerequisite counts as satisfied when it is completed or cancelled. */
export function isPrereqSatisfied(status: Idea["status"] | undefined): boolean {
  return status === "completed" || status === "cancelled";
}

/**
 * Derived "ready to work" state (never persisted): the task is not terminal
 * and every `depends_on` prerequisite is completed or cancelled.
 * A missing prerequisite task counts as unsatisfied.
 */
export function isReady(task: TaskRef, links: LinkRef[], byId: StatusLookup): boolean {
  if (TERMINAL_STATUSES.includes(task.status)) return false;
  for (const link of links) {
    if (link.link_type !== "depends_on" || link.source_id !== task.id) continue;
    if (!isPrereqSatisfied(byId.get(link.target_id)?.status)) return false;
  }
  return true;
}

export interface PathProgress {
  done: number;
  total: number;
}

/**
 * Derived progress (never persisted): members with status completed or
 * cancelled count as done. Unknown tasks (deleted) are excluded.
 */
export function pathProgress(items: Pick<PathItem, "idea_id">[], byId: StatusLookup): PathProgress {
  let total = 0;
  let done = 0;
  for (const item of dedupePathItems(items)) {
    if (!item.idea_id) continue;
    const status = byId.get(item.idea_id)?.status;
    if (!status) continue;
    total += 1;
    if (status === "completed" || status === "cancelled") done += 1;
  }
  return { done, total };
}

/**
 * Derived endpoints (never persisted): member ids that no other member
 * depends on — the sinks of the path. In canvas direction (prerequisite →
 * dependent) these are the nodes with no outgoing edge inside the path.
 */
export function pathEndpoints(items: Pick<PathItem, "idea_id">[], links: LinkRef[]): string[] {
  const members = new Set(dedupePathItems(items).flatMap((i) => (i.idea_id ? [i.idea_id] : [])));
  const dependedOn = new Set<string>();
  for (const link of links) {
    if (link.link_type !== "depends_on") continue;
    if (members.has(link.source_id) && members.has(link.target_id)) {
      dependedOn.add(link.target_id);
    }
  }
  return [...members].filter((id) => !dependedOn.has(id));
}

export interface PathMembershipRow {
  idea_id: string;
  path_id: string;
  title: string;
}

/**
 * Derived membership (never persisted): task id → sorted path titles.
 * One row per (path, task) pair from the `path_items JOIN paths` query.
 */
export function buildPathMembership(rows: PathMembershipRow[]): Map<string, string[]> {
  const byIdea = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.idea_id || !row.path_id) continue;
    const set = byIdea.get(row.idea_id) ?? new Set<string>();
    set.add(row.title || "Untitled path");
    byIdea.set(row.idea_id, set);
  }
  return new Map([...byIdea].map(([id, titles]) => [id, [...titles].sort()]));
}

export interface PathEdgeRef {
  source: string;
  target: string;
}

/**
 * True when connecting source → target would close a dependency cycle.
 * Moved from the removed legacy `projectWorkflow` module: the paths canvas
 * still guards `depends_on` links against cycles.
 */
export function wouldCreateCycle(edges: PathEdgeRef[], source: string, target: string): boolean {
  if (source === target) return true;
  const outgoing = new Map<string, string[]>();
  for (const edge of edges)
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length) {
    const current = stack.pop()!;
    if (current === source) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(outgoing.get(current) ?? []));
  }
  return false;
}

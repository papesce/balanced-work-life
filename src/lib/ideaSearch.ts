import type { Idea } from "@/lib/types";

export const DONE_STATUSES: Idea["status"][] = ["completed", "cancelled", "archived"];

export function getTypeLabel(type: Idea["type"]): string {
  if (!type) return "Idea";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function formatScheduleLabel(idea: Idea): string | null {
  if (!idea.scheduled_date) return null;
  if (idea.scheduled_time) return `${idea.scheduled_date} · ${idea.scheduled_time.slice(0, 5)}`;
  return idea.scheduled_date;
}

export function getPathLabel(idea: Idea, ideasById: Map<string, Idea>): string {
  const segments: string[] = [];
  const visited = new Set<string>([idea.id]);
  let current: Idea | undefined = idea;
  while (current?.parent_id && !visited.has(current.parent_id)) {
    visited.add(current.parent_id);
    const parent = ideasById.get(current.parent_id);
    if (!parent) break;
    segments.unshift(parent.text || "empty");
    current = parent;
  }
  return segments.length > 0 ? segments.join(" › ") : "Root";
}

export interface SearchIdeasOptions {
  excludeIds?: Set<string>;
  includeDone?: boolean;
  limit?: number;
}

/** Multi-word AND match over text + notes (case-insensitive). */
export function searchIdeas(
  ideas: Idea[],
  rawQuery: string,
  options: SearchIdeasOptions = {},
): Idea[] {
  const { excludeIds, includeDone = true, limit = 10 } = options;
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];
  const words = query.split(/\s+/).filter(Boolean);
  return ideas
    .filter((idea) => {
      if (excludeIds?.has(idea.id)) return false;
      if (!includeDone && DONE_STATUSES.includes(idea.status)) return false;
      const haystack = `${idea.text ?? ""} ${idea.notes ?? ""}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .slice(0, limit);
}

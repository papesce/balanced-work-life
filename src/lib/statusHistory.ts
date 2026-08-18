import { Idea, IdeaStatus } from "@/lib/types";

export function appendStatusHistory(
  idea: Idea,
  newStatus: IdeaStatus,
): { status: IdeaStatus; at: string }[] {
  const existing = idea.status_history ?? [];
  return [...existing, { status: newStatus, at: new Date().toISOString() }];
}

export function getCommitCount(history: { status: IdeaStatus; at: string }[] | null): number {
  if (!history) return 0;
  return history.filter((e) => e.status === "planned" || e.status === "in_progress").length;
}

export function getAbandonCount(history: { status: IdeaStatus; at: string }[] | null): number {
  if (!history) return 0;
  return history.filter((e) => e.status === "paused" || e.status === "archived").length;
}

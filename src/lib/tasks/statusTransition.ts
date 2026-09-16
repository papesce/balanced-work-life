import { Idea, IdeaStatus } from "@/lib/types";

type UpdateFn = (id: string, updates: Partial<Idea>) => void;

export function computeStatusUpdates(status: IdeaStatus): Partial<Idea> {
  const now = new Date().toISOString();
  switch (status) {
    case "completed":
      return { status: "completed", completed_at: now };
    case "cancelled":
      return { status: "cancelled", cancelled_at: now };
    case "in_progress":
      return { status: "in_progress" };
    case "paused":
      return { status: "paused", paused_at: now };
    case "planned":
    case "scheduled":
    case "draft":
      return {
        status,
        completed_at: null,
        cancelled_at: null,
        paused_at: null,
      };
    case "deferred":
      return {
        status: "deferred",
        scheduled_time: null,
        duration_minutes: null,
        completed_at: null,
        cancelled_at: null,
        paused_at: null,
      };
    case "archived":
      return { status: "archived" };
    default:
      return { status };
  }
}

export function applyStatusTransition(
  id: string,
  status: IdeaStatus,
  onUpdate: UpdateFn,
  callbacks?: {
    onDone?: (id: string) => void;
    onUndone?: (id: string) => void;
  },
) {
  if (status === "completed" && callbacks?.onDone) {
    callbacks.onDone(id);
    return;
  }
  if (status === "scheduled" && callbacks?.onUndone) {
    callbacks.onUndone(id);
    return;
  }
  onUpdate(id, computeStatusUpdates(status));
}

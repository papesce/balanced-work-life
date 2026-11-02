import type { Idea } from "@/lib/types";

export function isTask(idea: Idea): idea is Idea & { type: "task" } {
  return idea.type === "task";
}

export function isEvent(idea: Idea): idea is Idea & { type: "event" } {
  return idea.type === "event";
}

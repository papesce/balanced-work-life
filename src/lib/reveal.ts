"use client";

import { getToday } from "@/lib/dateUtils";
import type { Idea, IdeaHorizon } from "@/lib/types";

export type RevealView = "planner" | "timeline" | "horizon" | "brainstorm" | "projects";

export interface RevealOption {
  view: RevealView;
  label: string;
  href: string;
  icon: RevealView;
}

const LABELS: Record<RevealView, string> = {
  planner: "Daily Planner",
  timeline: "Timeline",
  horizon: "Horizon",
  brainstorm: "Brainstorm",
  projects: "Projects",
};

function getProjectAncestorId(idea: Idea, allIdeas?: Idea[]): string | null {
  if (idea.type === "project") return idea.id;
  if (!allIdeas) return null;
  const byId = new Map(allIdeas.map((i) => [i.id, i]));
  let current: Idea | undefined = idea;
  while (current?.parent_id) {
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    if (parent.type === "project") return parent.id;
    current = parent;
  }
  return null;
}

export function getRevealHref(view: RevealView, idea: Idea, allIdeas?: Idea[]): string {
  const date = idea.scheduled_date ?? getToday();
  const id = idea.id;
  switch (view) {
    case "planner":
      return `/?date=${date}&highlight=${id}`;
    case "timeline":
      return `/timeline?date=${date}&highlight=${id}`;
    case "horizon": {
      const h: IdeaHorizon = idea.horizon ?? "short";
      return `/horizon?horizon=${h}&highlight=${id}`;
    }
    case "brainstorm":
      return `/brainstorm?highlight=${id}`;
    case "projects": {
      const ancestorId = getProjectAncestorId(idea, allIdeas);
      if (ancestorId) return `/projects?projectId=${ancestorId}&highlight=${id}`;
      return `/projects?highlight=${id}`;
    }
  }
}

export function getRevealOptions(
  currentView: RevealView,
  idea: Idea,
  allIdeas?: Idea[],
): RevealOption[] {
  const views: RevealView[] = ["planner", "timeline", "horizon", "brainstorm", "projects"];
  return views
    .filter((v) => v !== currentView)
    .map((v) => ({
      view: v,
      label: LABELS[v],
      href: getRevealHref(v, idea, allIdeas),
      icon: v,
    }));
}

export function getRevealLabel(view: RevealView): string {
  return LABELS[view];
}

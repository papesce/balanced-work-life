"use client";

import { getToday } from "@/lib/dateUtils";
import type { Idea } from "@/lib/types";

export type RevealView = "planner" | "timeline" | "horizon" | "brainstorm" | "projects" | "goals";

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
  goals: "Goals",
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

function getGoalAncestorId(idea: Idea, allIdeas?: Idea[]): string | null {
  if (idea.type === "objective") return idea.id;
  if (!allIdeas) return null;
  const byId = new Map(allIdeas.map((i) => [i.id, i]));
  let current: Idea | undefined = idea;
  while (current?.parent_id) {
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    if (parent.type === "objective") return parent.id;
    current = parent;
  }
  return null;
}

export function getRevealHref(
  view: RevealView,
  idea: Idea,
  allIdeas?: Idea[],
  termValue?: string | null,
  lensKey?: string | null,
): string {
  const date = idea.scheduled_date ?? getToday();
  const id = idea.id;
  switch (view) {
    case "planner":
      return `/?date=${date}&highlight=${id}`;
    case "timeline":
      return `/timeline?date=${date}&highlight=${id}`;
    case "horizon": {
      const lens = lensKey ?? "term";
      const h = termValue ?? "short";
      return `/horizon?lens=${lens}&horizon=${h}&highlight=${id}`;
    }
    case "brainstorm":
      return `/brainstorm?highlight=${id}`;
    case "projects": {
      const ancestorId = getProjectAncestorId(idea, allIdeas);
      if (ancestorId) return `/projects?projectId=${ancestorId}&highlight=${id}`;
      return `/projects?highlight=${id}`;
    }
    case "goals": {
      const ancestorId = getGoalAncestorId(idea, allIdeas);
      if (ancestorId) return `/goals?goalId=${ancestorId}&highlight=${id}`;
      return `/goals?highlight=${id}`;
    }
  }
}

export function getRevealOptions(
  currentView: RevealView,
  idea: Idea,
  allIdeas?: Idea[],
): RevealOption[] {
  const views: RevealView[] = ["planner", "timeline", "horizon", "brainstorm", "projects", "goals"];
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

/**
 * Determine the single best view to navigate to for a given idea.
 * Priority: scheduled → projects → goals → brainstorm.
 */
export function getSmartRevealView(idea: Idea, allIdeas?: Idea[]): RevealView {
  if (idea.scheduled_date) return "timeline";
  if (idea.type === "project" || getProjectAncestorId(idea, allIdeas)) return "projects";
  if (idea.type === "objective" || getGoalAncestorId(idea, allIdeas)) return "goals";
  return "brainstorm";
}

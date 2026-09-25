"use client";

import { getToday, getWindowRange } from "@/lib/dateUtils";
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

/**
 * Whether navigating to `view` for `idea` can actually render + highlight it.
 * - planner/timeline only render tasks as date occurrences: scheduled or with
 *   past attempt dates (historical occurrences). Archived never renders there,
 *   and non-task types (project/objective/idea) never render there.
 * - projects/goals list views only render ideas in (or as) a project/objective.
 * - brainstorm `this_month` scope only loads ideas scheduled this month or
 *   unscheduled + active; completed/cancelled/archived or far-dated ideas fail.
 * - horizon loads everything, so it always reveals.
 */
export function canRevealInView(view: RevealView, idea: Idea, allIdeas?: Idea[]): boolean {
  switch (view) {
    case "planner":
    case "timeline": {
      if (idea.type !== "task" || idea.status === "archived") return false;
      return Boolean(idea.scheduled_date || (idea.attempt_dates?.length ?? 0) > 0);
    }
    case "projects":
      return idea.type === "project" || getProjectAncestorId(idea, allIdeas) !== null;
    case "goals":
      return idea.type === "objective" || getGoalAncestorId(idea, allIdeas) !== null;
    case "brainstorm": {
      if (idea.scheduled_date) {
        const { start, end } = getWindowRange("month", getToday());
        return idea.scheduled_date >= start && idea.scheduled_date <= end;
      }
      return (
        idea.status !== "completed" && idea.status !== "cancelled" && idea.status !== "archived"
      );
    }
    case "horizon":
      return true;
  }
}

export function getRevealOptions(
  currentView: RevealView,
  idea: Idea,
  allIdeas?: Idea[],
): RevealOption[] {
  const views: RevealView[] = ["planner", "timeline", "horizon", "brainstorm", "projects", "goals"];
  const revealable = views.filter((v) => v !== currentView && canRevealInView(v, idea, allIdeas));
  // Never return an empty menu: fall back to the smart view.
  const finalViews = revealable.length > 0 ? revealable : [getSmartRevealView(idea, allIdeas)];
  return finalViews
    .filter((v) => v !== currentView)
    .map((v) => ({
      view: v,
      label: LABELS[v],
      href: getRevealHref(v, idea, allIdeas),
      icon: v,
    }));
}

export interface CurrentViewRevealOption extends RevealOption {
  isCurrentView: boolean;
}

/**
 * Search-menu variant: includes the current view first (labelled
 * "… (this view)") so users on Horizon can reveal in place.
 * Callers supply the resolved termValue/lensKey for an exact horizon URL.
 */
export function getRevealOptionsIncludingCurrent(
  currentView: RevealView,
  idea: Idea,
  allIdeas?: Idea[],
  termValue?: string | null,
  lensKey?: string | null,
): CurrentViewRevealOption[] {
  const views: RevealView[] = ["planner", "timeline", "horizon", "brainstorm", "projects", "goals"];
  // The current view is only listed when it can actually reveal the idea;
  // otherwise the menu shows just the views that can (Enter falls back to
  // the smart view via openInCurrentView).
  const ordered: RevealView[] = [currentView, ...views.filter((v) => v !== currentView)].filter(
    (v) => canRevealInView(v, idea, allIdeas),
  );
  // Never return an empty menu: fall back to the smart view.
  const finalOrdered = ordered.length > 0 ? ordered : [getSmartRevealView(idea, allIdeas)];
  return finalOrdered.map((v) => ({
    view: v,
    label: v === currentView ? `${LABELS[v]} (this view)` : LABELS[v],
    href:
      v === currentView
        ? getRevealHref(v, idea, allIdeas, termValue, lensKey)
        : getRevealHref(v, idea, allIdeas),
    icon: v,
    isCurrentView: v === currentView,
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

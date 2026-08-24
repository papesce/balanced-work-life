"use client";

import { getToday } from "@/lib/dateUtils";
import type { Idea, IdeaHorizon } from "@/lib/types";

export type RevealView = "planner" | "timeline" | "horizon" | "brainstorm";

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
};

export function getRevealHref(view: RevealView, idea: Idea): string {
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
  }
}

export function getRevealOptions(currentView: RevealView, idea: Idea): RevealOption[] {
  const views: RevealView[] = ["planner", "timeline", "horizon", "brainstorm"];
  return views
    .filter((v) => v !== currentView)
    .map((v) => ({
      view: v,
      label: LABELS[v],
      href: getRevealHref(v, idea),
      icon: v,
    }));
}

export function getRevealLabel(view: RevealView): string {
  return LABELS[view];
}

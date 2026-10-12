"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, readRawString } from "@/lib/storage";

export const UI_PREFS_KEY = "bwl-ui-prefs-v1";

interface TimelinePrefs {
  filter: string;
  preset: string;
  view: string;
  weekCardPreview: string;
}

interface UiPrefsState {
  projectsLens: string;
  horizonLens: string;
  /** Last selected built-in Horizon lens id (local device state). */
  horizonLensId: string | null;
  /** Currently active saved Horizon view id (local device state). */
  horizonActiveViewId: string | null;
  projectsUnclassifiedExpanded: boolean;
  projectsDetailHideCompleted: boolean;
  horizonUnclassifiedExpanded: boolean;
  horizonHideProjectsWithTasks: boolean;
  horizonHideCommitted: boolean;
  /** Hide upcoming / in-motion committed work (dated today+, undated in-progress). */
  horizonHideUpcomingCommitted: boolean;
  /** Hide overdue committed work (dated before today). Off surfaces past-due for rescheduling. */
  horizonHideOverdueCommitted: boolean;
  horizonShowClassificationOrder: boolean;
  cardMode: boolean;
  sidebarCollapsed: boolean | null;
  plannerHideCompleted: boolean;
  timelinePrefs: TimelinePrefs | null;
  /** Last selected path id per project (local device state). */
  projectLastPath: Record<string, string>;
  set: (partial: Partial<UiPrefsState>) => void;
}

function readLegacy(): Partial<UiPrefsState> {
  if (typeof window === "undefined") return {};
  const out: Partial<UiPrefsState> = {};
  const projectsLens = readRawString(STORAGE_KEYS.projectsLens);
  if (projectsLens) out.projectsLens = projectsLens;
  const horizonLens = readRawString(STORAGE_KEYS.horizonLens);
  if (horizonLens) out.horizonLens = horizonLens;
  const pUncl = readRawString(STORAGE_KEYS.projectsUnclassifiedExpanded);
  if (pUncl !== null) out.projectsUnclassifiedExpanded = pUncl !== "false";
  const hUncl = readRawString(STORAGE_KEYS.horizonUnclassifiedExpanded);
  if (hUncl !== null) out.horizonUnclassifiedExpanded = hUncl === "true";
  const card = readRawString(STORAGE_KEYS.brainstormCardMode);
  if (card !== null) out.cardMode = card === "true";
  const side = readRawString(STORAGE_KEYS.sidebarCollapsed);
  if (side !== null) out.sidebarCollapsed = side === "true";
  const hide = readRawString(STORAGE_KEYS.plannerHideCompleted);
  if (hide !== null) out.plannerHideCompleted = hide === "true";
  return out;
}

export const useUiPrefsStore = create<UiPrefsState>()(
  persist(
    (set) => ({
      projectsLens: "term",
      horizonLens: "term",
      horizonLensId: null,
      horizonActiveViewId: null,
      projectsUnclassifiedExpanded: true,
      projectsDetailHideCompleted: true,
      horizonUnclassifiedExpanded: false,
      horizonHideProjectsWithTasks: true,
      horizonHideCommitted: true,
      horizonHideUpcomingCommitted: true,
      horizonHideOverdueCommitted: false,
      horizonShowClassificationOrder: true,
      cardMode: false,
      sidebarCollapsed: null,
      plannerHideCompleted: true,
      timelinePrefs: null,
      projectLastPath: {},
      set: (partial) => set(partial),
    }),
    {
      name: UI_PREFS_KEY,
      version: 1,
      partialize: (s) => ({
        projectsLens: s.projectsLens,
        horizonLens: s.horizonLens,
        horizonLensId: s.horizonLensId,
        horizonActiveViewId: s.horizonActiveViewId,
        projectsUnclassifiedExpanded: s.projectsUnclassifiedExpanded,
        projectsDetailHideCompleted: s.projectsDetailHideCompleted,
        horizonUnclassifiedExpanded: s.horizonUnclassifiedExpanded,
        horizonHideProjectsWithTasks: s.horizonHideProjectsWithTasks,
        horizonHideUpcomingCommitted: s.horizonHideUpcomingCommitted,
        horizonHideOverdueCommitted: s.horizonHideOverdueCommitted,
        horizonShowClassificationOrder: s.horizonShowClassificationOrder,
        cardMode: s.cardMode,
        sidebarCollapsed: s.sidebarCollapsed,
        plannerHideCompleted: s.plannerHideCompleted,
        timelinePrefs: s.timelinePrefs,
        projectLastPath: s.projectLastPath,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UiPrefsState> & { horizonHideCommitted?: boolean };
        // First run: no persisted slice yet → seed from legacy per-key entries.
        const legacy = readLegacy();
        const merged = { ...current, ...legacy, ...p };
        // One-time migration from the single Hide committed toggle (removed):
        // hiding everything maps to both new toggles on, showing maps to both off.
        if (
          p.horizonHideUpcomingCommitted === undefined &&
          p.horizonHideOverdueCommitted === undefined &&
          p.horizonHideCommitted !== undefined
        ) {
          merged.horizonHideUpcomingCommitted = p.horizonHideCommitted;
          merged.horizonHideOverdueCommitted = p.horizonHideCommitted;
        }
        return merged;
      },
    },
  ),
);

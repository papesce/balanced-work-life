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
  projectsUnclassifiedExpanded: boolean;
  horizonUnclassifiedExpanded: boolean;
  cardMode: boolean;
  sidebarCollapsed: boolean | null;
  plannerHideCompleted: boolean;
  timelinePrefs: TimelinePrefs | null;
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
      projectsUnclassifiedExpanded: true,
      horizonUnclassifiedExpanded: false,
      cardMode: false,
      sidebarCollapsed: null,
      plannerHideCompleted: true,
      timelinePrefs: null,
      set: (partial) => set(partial),
    }),
    {
      name: UI_PREFS_KEY,
      version: 1,
      partialize: (s) => ({
        projectsLens: s.projectsLens,
        horizonLens: s.horizonLens,
        projectsUnclassifiedExpanded: s.projectsUnclassifiedExpanded,
        horizonUnclassifiedExpanded: s.horizonUnclassifiedExpanded,
        cardMode: s.cardMode,
        sidebarCollapsed: s.sidebarCollapsed,
        plannerHideCompleted: s.plannerHideCompleted,
        timelinePrefs: s.timelinePrefs,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UiPrefsState>;
        // First run: no persisted slice yet → seed from legacy per-key entries.
        const legacy = readLegacy();
        return { ...current, ...legacy, ...p };
      },
    },
  ),
);

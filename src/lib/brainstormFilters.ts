import { STORAGE_KEYS, readJson, readRawString } from "@/lib/storage";
import type { IdeaType } from "@/lib/types";
import type { IdeasScope } from "@/hooks/useIdeas";

export interface BrainstormFilters {
  showType: boolean;
  showArea: boolean;
  showToday: boolean;
  hideClosed: boolean;
  hideCompleted: boolean;
  hideDeferred: boolean;
  hideInHorizon: boolean;
  typeFilter: IdeaType[];
  timeScope: IdeasScope;
  groupUnassociatedPaths: boolean;
}

export const DEFAULT_BRAINSTORM_FILTERS: BrainstormFilters = {
  showType: true,
  showArea: true,
  showToday: false,
  hideClosed: false,
  hideCompleted: false,
  hideDeferred: false,
  hideInHorizon: false,
  typeFilter: [],
  timeScope: "this_month",
  groupUnassociatedPaths: true,
};

const IDEA_TYPES: IdeaType[] = ["idea", "objective", "project", "initiative", "task", "path"];

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function loadBrainstormFilters(): BrainstormFilters {
  const stored = readJson<Partial<BrainstormFilters>>(STORAGE_KEYS.brainstormFilters) ?? {};
  // One-time migration: legacy per-key hideInHorizon seeds the new object.
  let legacyHide: boolean | undefined;
  const legacyRaw = readRawString(STORAGE_KEYS.brainstormHideInHorizon);
  if (legacyRaw !== null) legacyHide = legacyRaw === "true";

  const typeFilter = Array.isArray(stored.typeFilter)
    ? stored.typeFilter.filter((t): t is IdeaType => IDEA_TYPES.includes(t as IdeaType))
    : DEFAULT_BRAINSTORM_FILTERS.typeFilter;

  return {
    showType: asBool(stored.showType, DEFAULT_BRAINSTORM_FILTERS.showType),
    showArea: asBool(stored.showArea, DEFAULT_BRAINSTORM_FILTERS.showArea),
    showToday: asBool(stored.showToday, DEFAULT_BRAINSTORM_FILTERS.showToday),
    hideClosed: asBool(stored.hideClosed, DEFAULT_BRAINSTORM_FILTERS.hideClosed),
    hideCompleted: asBool(stored.hideCompleted, DEFAULT_BRAINSTORM_FILTERS.hideCompleted),
    hideDeferred: asBool(stored.hideDeferred, DEFAULT_BRAINSTORM_FILTERS.hideDeferred),
    hideInHorizon:
      typeof stored.hideInHorizon === "boolean"
        ? stored.hideInHorizon
        : (legacyHide ?? DEFAULT_BRAINSTORM_FILTERS.hideInHorizon),
    typeFilter,
    timeScope: stored.timeScope === "all" ? "all" : "this_month",
    groupUnassociatedPaths: asBool(
      stored.groupUnassociatedPaths,
      DEFAULT_BRAINSTORM_FILTERS.groupUnassociatedPaths,
    ),
  };
}

export function countActiveBrainstormFilters(f: BrainstormFilters): number {
  return (
    (f.showToday ? 1 : 0) +
    (f.hideClosed ? 1 : 0) +
    (f.hideCompleted ? 1 : 0) +
    (f.hideDeferred ? 1 : 0) +
    (f.hideInHorizon ? 1 : 0) +
    (f.typeFilter.length > 0 ? 1 : 0) +
    (!f.showType ? 1 : 0) +
    (!f.showArea ? 1 : 0)
  );
}

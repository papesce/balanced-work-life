"use client";

import type { ClassificationOption, ClassificationScheme, IdeaClassification } from "@/lib/types";

/** Sentinel record key for the explicit unclassified group. */
export const UNCLASSIFIED = "unclassified";

/** A lens column: an option value, or null for the unclassified group. */
export interface LensColumn {
  key: string | null;
  label: string;
}

/** Record key for a value: the option value, or the unclassified sentinel. */
export function groupKeyOf(value: string | null): string {
  return value ?? UNCLASSIFIED;
}

/** Generic ideaId -> value map for every classification scheme key. */
export function buildValuesBySchemeKey(
  schemes: ClassificationScheme[],
  classificationOptions: ClassificationOption[],
  classifications: IdeaClassification[],
): Map<string, Map<string, string>> {
  const outer = new Map<string, Map<string, string>>();
  const optionValueById = new Map(classificationOptions.map((o) => [o.id, o.value]));
  const schemeKeyById = new Map(schemes.map((s) => [s.id, s.key]));
  for (const c of classifications) {
    const schemeKey = schemeKeyById.get(c.scheme_id);
    if (!schemeKey) continue;
    const v = optionValueById.get(c.option_id);
    if (typeof v !== "string") continue;
    let inner = outer.get(schemeKey);
    if (!inner) {
      inner = new Map<string, string>();
      outer.set(schemeKey, inner);
    }
    inner.set(c.idea_id, v);
  }
  return outer;
}

/** Options of one scheme, ordered by sort_order. */
export function optionsForScheme(
  classificationOptions: ClassificationOption[],
  schemeId: string,
): { value: string; label: string }[] {
  return classificationOptions
    .filter((o) => o.scheme_id === schemeId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((o) => ({ value: o.value, label: o.label }));
}

/**
 * Horizon lenses: a lens is a presentation overlay on top of a
 * classification scheme. Schemes stay the data; the lens adds a
 * human-friendly name, an explicit column order and tiebreakers that order
 * items inside each column. Built-in lenses are code constants (no DB).
 */

export interface LensTiebreaker {
  scheme: string;
  direction: "asc" | "desc";
}

export interface HorizonLensDef {
  id: string;
  name: string;
  description?: string;
  /** Scheme key the lens groups by. */
  primaryScheme: string;
  /** Option values in explicit column order. */
  columnOrder: string[];
  tiebreakers: LensTiebreaker[];
}

export const DEFAULT_LENSES: HorizonLensDef[] = [
  {
    id: "closest",
    name: "Closest in time",
    description: "What comes first",
    primaryScheme: "when",
    columnOrder: [
      "this_week",
      "next_week",
      "this_month",
      "next_month",
      "this_year",
      "next_year",
      "later",
    ],
    tiebreakers: [
      { scheme: "nnl", direction: "asc" },
      { scheme: "priority", direction: "asc" },
    ],
  },
  {
    id: "easiest",
    name: "Easiest first",
    description: "What I can resolve with little effort",
    primaryScheme: "effort",
    columnOrder: ["quick", "focused", "substantial", "deep", "epic"],
    tiebreakers: [{ scheme: "priority", direction: "asc" }],
  },
  {
    id: "matters",
    name: "What matters most",
    description: "What I can't skip",
    primaryScheme: "moscow",
    columnOrder: ["must", "should", "could", "wont"],
    tiebreakers: [
      { scheme: "priority", direction: "asc" },
      { scheme: "when", direction: "asc" },
    ],
  },
  {
    id: "ready",
    name: "Ready to move",
    description: "What is ready to advance or finish",
    primaryScheme: "attention",
    columnOrder: ["ready_to_complete", "about_to_start", "ready_to_start", "dont_forget_about"],
    tiebreakers: [{ scheme: "effort", direction: "asc" }],
  },
  {
    id: "looking-ahead",
    name: "Looking ahead",
    description: "Short, medium and long term",
    primaryScheme: "term",
    columnOrder: ["short", "medium", "long"],
    tiebreakers: [{ scheme: "priority", direction: "asc" }],
  },
  {
    id: "payoff",
    name: "Biggest payoff",
    description: "What adds the most value",
    primaryScheme: "impact",
    columnOrder: ["high", "medium", "low"],
    tiebreakers: [{ scheme: "effort", direction: "asc" }],
  },
];

export interface LensSchemeInfo {
  key: string;
  label: string;
  /** Option values in scheme (sort_order) order. */
  options: string[];
}

/**
 * Resolve any scheme key or lens id to a lens definition. A default lens
 * whose primaryScheme matches wins (first match); otherwise a synthesized
 * lens preserves today's behavior exactly (scheme order + priority
 * tiebreaker). Unknown keys fall back to the term lens. Synthesized lenses
 * are reachable via deep links and saved views but never listed.
 */
export function resolveLens(
  schemeKeyOrLensId: string,
  schemes: LensSchemeInfo[],
): { lens: HorizonLensDef; synthesized: boolean } {
  const byId = DEFAULT_LENSES.find((l) => l.id === schemeKeyOrLensId);
  if (byId) return { lens: byId, synthesized: false };
  const byScheme = DEFAULT_LENSES.find((l) => l.primaryScheme === schemeKeyOrLensId);
  if (byScheme) return { lens: byScheme, synthesized: false };
  const scheme = schemes.find((s) => s.key === schemeKeyOrLensId);
  if (scheme) {
    return {
      lens: {
        id: scheme.key,
        name: scheme.label,
        primaryScheme: scheme.key,
        columnOrder: [...scheme.options],
        tiebreakers: [{ scheme: "priority", direction: "asc" }],
      },
      synthesized: true,
    };
  }
  const term = DEFAULT_LENSES.find((l) => l.primaryScheme === "term")!;
  return { lens: term, synthesized: false };
}

export interface LensColumn {
  key: string | null;
  label: string;
}

/**
 * Column list for a lens: explicit columnOrder filtered to options that
 * exist at runtime, then any remaining scheme options in scheme order, then
 * Unclassified. Never drops a real option.
 */
export function buildLensColumns(
  lens: HorizonLensDef,
  schemeOptions: { value: string; label: string }[],
): LensColumn[] {
  const existing = new Set(schemeOptions.map((o) => o.value));
  const ordered = lens.columnOrder.filter((v) => existing.has(v));
  const leftovers = schemeOptions.map((o) => o.value).filter((v) => !ordered.includes(v));
  const labelByValue = new Map(schemeOptions.map((o) => [o.value, o.label]));
  return [
    ...[...ordered, ...leftovers].map((value) => ({
      key: value as string,
      label: labelByValue.get(value) ?? value,
    })),
    { key: null, label: "Unclassified" },
  ];
}

/**
 * Compare two items by the lens tiebreakers. rankOf returns the option index
 * within the scheme order, or null when the item has no value. Unvalued
 * items sort LAST regardless of direction; ties fall back to sort_order.
 */
export function compareByTiebreakers(
  tiebreakers: LensTiebreaker[],
  rankOf: (scheme: string, ideaId: string) => number | null,
  sortOrderOf: (ideaId: string) => number,
  aId: string,
  bId: string,
): number {
  for (const t of tiebreakers) {
    const aRank = rankOf(t.scheme, aId);
    const bRank = rankOf(t.scheme, bId);
    if (aRank == null && bRank == null) continue;
    // Unvalued sorts last regardless of direction.
    if (aRank == null) return 1;
    if (bRank == null) return -1;
    if (aRank !== bRank) return t.direction === "asc" ? aRank - bRank : bRank - aRank;
  }
  return sortOrderOf(aId) - sortOrderOf(bId);
}

/**
 * Build the per-column comparator for a lens from live classification data.
 * optionOrderByScheme maps scheme key -> option values in scheme order;
 * valueOf maps `${ideaId}::${schemeKey}` -> option value (or null).
 */
export function buildLensComparator(
  lens: HorizonLensDef,
  optionOrderByScheme: Map<string, string[]>,
  valueOf: (ideaId: string, schemeKey: string) => string | null,
  sortOrderOf: (ideaId: string) => number,
): (aId: string, bId: string) => number {
  const rankOf = (scheme: string, ideaId: string): number | null => {
    const order = optionOrderByScheme.get(scheme);
    if (!order) return null;
    const value = valueOf(ideaId, scheme);
    if (value == null) return null;
    const idx = order.indexOf(value);
    return idx === -1 ? null : idx;
  };
  return (aId, bId) => compareByTiebreakers(lens.tiebreakers, rankOf, sortOrderOf, aId, bId);
}

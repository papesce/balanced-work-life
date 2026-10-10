/**
 * Horizon lenses: a lens is a presentation overlay on top of a
 * classification scheme. Schemes stay the data; the lens adds a
 * human-friendly name, an explicit column order and a default secondary
 * (split) scheme per column that orders/group items inside each column.
 * Built-in lenses are code constants (no DB).
 */

export interface HorizonLensDef {
  id: string;
  name: string;
  description?: string;
  /** Scheme key the lens groups by. */
  primaryScheme: string;
  /** Option values in explicit column order. */
  columnOrder: string[];
  /** Default secondary scheme per column group key (column option value, or
   *  "unclassified" for the null column). A user-set per-column Split
   *  overrides these; an explicit "None" (null) disables ordering. */
  defaultSplits: Record<string, string | null>;
  /** When true, this lens always includes committed work (scheduled,
   *  in-progress, dated) even while the board's Hide committed filter is
   *  on. Only the "Ready to move" lens sets this. */
  includeCommitted?: boolean;
}

/** Default secondary scheme for every column of a lens: all listed values
 *  plus "unclassified" resolve to the same secondary scheme. */
function splitsForAll(order: string[], scheme: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const k of [...order, "unclassified"]) out[k] = scheme;
  return out;
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
    defaultSplits: splitsForAll(
      ["this_week", "next_week", "this_month", "next_month", "this_year", "next_year", "later"],
      "nnl",
    ),
  },
  {
    id: "easiest",
    name: "Easiest first",
    description: "What I can resolve with little effort",
    primaryScheme: "effort",
    columnOrder: ["quick", "focused", "substantial", "deep", "epic"],
    defaultSplits: splitsForAll(["quick", "focused", "substantial", "deep", "epic"], "priority"),
  },
  {
    id: "matters",
    name: "What matters most",
    description: "What I can't skip",
    primaryScheme: "moscow",
    columnOrder: ["must", "should", "could", "wont"],
    defaultSplits: splitsForAll(["must", "should", "could", "wont"], "priority"),
  },
  {
    id: "ready",
    name: "Ready to move",
    description: "What is ready to advance or finish",
    primaryScheme: "attention",
    includeCommitted: true,
    columnOrder: ["ready_to_complete", "about_to_start", "ready_to_start", "dont_forget_about"],
    defaultSplits: splitsForAll(
      ["ready_to_complete", "about_to_start", "ready_to_start", "dont_forget_about"],
      "effort",
    ),
  },
  {
    id: "looking-ahead",
    name: "Looking ahead",
    description: "Short, medium and long term",
    primaryScheme: "term",
    columnOrder: ["short", "medium", "long"],
    defaultSplits: splitsForAll(["short", "medium", "long"], "priority"),
  },
  {
    id: "payoff",
    name: "Biggest payoff",
    description: "What adds the most value",
    primaryScheme: "impact",
    columnOrder: ["high", "medium", "low"],
    defaultSplits: splitsForAll(["high", "medium", "low"], "effort"),
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
 * lens preserves today's behavior exactly (scheme order, no default
 * splits). Unknown keys fall back to the term lens. Synthesized lenses
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
        defaultSplits: {},
      },
      synthesized: true,
    };
  }
  const term = DEFAULT_LENSES.find((l) => l.primaryScheme === "term") ?? DEFAULT_LENSES[0];
  if (!term) throw new Error("DEFAULT_LENSES must define at least one lens");
  return { lens: term, synthesized: false };
}

/**
 * Normalize a ?lens= value (or stored key) to a primary scheme key: scheme
 * keys pass through, built-in lens ids map to their primary scheme, unknown
 * values pass through for the Term fallback in useLens.
 */
export function primarySchemeForKey(key: string, schemeKeys: Set<string>): string {
  if (schemeKeys.has(key)) return key;
  return DEFAULT_LENSES.find((l) => l.id === key)?.primaryScheme ?? key;
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

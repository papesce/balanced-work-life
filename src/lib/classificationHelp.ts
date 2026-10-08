/**
 * One-line explanations for classification values, shown via the ⓘ helper
 * next to each project card's classification value in the Projects view.
 * Keyed by lens/scheme key, then option value. Plain copy map — no DB or
 * sync involved. Keep each hint to a single short line.
 */
export const CLASSIFICATION_HINTS: Record<string, Record<string, string>> = {
  term: {
    short: "Pays off soon — weeks, not months.",
    medium: "Pays off over months — this year.",
    long: "Pays off over years — no rush.",
  },
  nnl: {
    now: "Actively being worked on right now.",
    next: "Up right after current work wraps up.",
    later: "Parked — revisit when capacity frees up.",
  },
  moscow: {
    must: "Non-negotiable — the project fails without it.",
    should: "Important, but the project survives without it.",
    could: "Nice to have if time and energy allow.",
    wont: "Explicitly out of scope for now.",
  },
  priority: {
    high: "Do first — highest leverage right now.",
    medium: "Steady progress — neither urgent nor idle.",
    low: "Background — whenever there's spare capacity.",
  },
  attention: {
    ready_to_complete: "Almost there — push it over the finish line.",
    about_to_start: "Starting soon — prep work is underway.",
    ready_to_start: "Ready when you are — just begin.",
    dont_forget_about: "Keep on the radar — don't let it slip.",
  },
  when: {
    this_week: "Happens this week.",
    next_week: "Happens next week.",
    this_month: "Happens this month.",
    next_month: "Happens next month.",
    this_year: "Happens this year.",
    next_year: "Happens next year.",
    later: "No date in mind yet.",
  },
  effort: {
    quick: "Minutes — a quick win.",
    focused: "A short focused session.",
    substantial: "Several sessions of real work.",
    deep: "Sustained deep work over days.",
    epic: "A major undertaking — break it down.",
  },
  impact: {
    high: "Big payoff — do it for the value it creates.",
    medium: "Solid payoff — worth doing well.",
    low: "Small payoff — only if there's spare capacity.",
  },
  area: {
    work: "Career, craft, and professional output.",
    health: "Body and mind — sleep, food, movement.",
    relationships: "Family, friends, and community.",
    growth: "Learning, skills, and personal development.",
    finances: "Money in, money out, and security.",
    life: "Home, admin, and everything else.",
  },
};

/** Short explanation for one lens value, if we have copy for it. */
export function hintForValue(lensKey: string, value: string | null): string | null {
  if (value == null) return null;
  return CLASSIFICATION_HINTS[lensKey]?.[value] ?? null;
}

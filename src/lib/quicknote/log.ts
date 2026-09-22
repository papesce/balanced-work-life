"use client";

/**
 * Quick-note logging. All investigation logging lives here behind a single
 * gate: silent in production unless enabled in the browser console with:
 *   localStorage.setItem("quicknote-debug", "1")
 * Disable with: localStorage.removeItem("quicknote-debug")
 *
 * Filters: [QuickNote] (verbose internals), [QuickNote:input] (keystroke
 * diffs), [QuickNote:sql] (save queries + upload queue), [QuickNote:sync]
 * (PowerSync status transitions, logged from providers.tsx).
 */

function loggingEnabled(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage?.getItem("quicknote-debug") === "1";
  } catch {
    return false;
  }
}

export function qnLoggingEnabled(): boolean {
  return loggingEnabled();
}

export function qnDebug(...args: unknown[]) {
  if (loggingEnabled()) console.log("[QuickNote]", ...args);
}

/** Keystroke logging: records WHAT changed on every edit (typed/removed chars). */
export function qnLogInput(caller: string, prev: string, next: string) {
  if (!loggingEnabled()) return;
  if (prev === next) {
    console.log(`[QuickNote:input] ${caller}: no change (len=${next.length})`);
    return;
  }
  // Diff via common prefix/suffix so we log the actual typed/removed chars.
  let start = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  const removed = prev.slice(start, endPrev).slice(0, 200);
  const added = next.slice(start, endNext).slice(0, 200);
  const parts: string[] = [];
  if (added.length > 0) parts.push(`typed ${JSON.stringify(added)}`);
  if (removed.length > 0) parts.push(`removed ${JSON.stringify(removed)}`);
  if (added.length === 0 && removed.length === 0)
    parts.push("change outside common diff (multiline edit)");
  console.log(
    `[QuickNote:input] ${caller}: len ${prev.length} → ${next.length} (${parts.join(", ")})`,
  );
}

export function qnLogQuery(
  outcome: "start" | "ok" | "fail",
  label: string,
  sql: string,
  params: unknown[],
) {
  if (!loggingEnabled()) return;
  const time = new Date().toISOString();
  if (outcome === "start") {
    console.log(
      `[QuickNote:sql] ${label} @ ${time}\n  SQL: ${sql}\n  params: ${JSON.stringify(params)?.slice(0, 500)}`,
    );
  } else if (outcome === "ok") {
    console.log(`[QuickNote:sql] ${label} OK @ ${time}`);
  } else {
    console.error(`[QuickNote:sql] ${label} FAILED @ ${time}`);
  }
}

/** Always-on one-liners for data-loss-relevant events (refusals, skips, wipes). */
export function qnWarn(message: string) {
  console.warn(`[QuickNote:sql] ${message}`);
}

export function qnError(message: string, err?: unknown) {
  console.error(`[QuickNote:sql] ${message}`, err);
}

export function qnInfo(message: string) {
  console.log(`[QuickNote:sql] ${message}`);
}

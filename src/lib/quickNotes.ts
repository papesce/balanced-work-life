/**
 * Pure functions for Quick Note text manipulation.
 *
 * The raw note text is the single source of truth. A line is considered
 * "resolved" if and only if it starts with the two-character sequence
 * U+2713 (✓) followed by one space. An optional `[matched:<ideaId>]`
 * tag may follow the checkmark to record which idea was matched.
 */

import type { Idea } from "@/lib/types";

export interface NoteLine {
  /** Original index in the full newline-split array (excluding blank lines). */
  index: number;
  /** Text content without any prefix. */
  text: string;
  /** Whether this line is resolved (starts with '✓ '). */
  resolved: boolean;
  /** If this line was resolved via "Match existing", the matched idea ID. */
  matchedIdeaId?: string;
}

export interface MatchResult {
  idea: Idea;
  score: number;
}

const RESOLVED_PREFIX = "✓ ";
const MATCHED_TAG_RE = /^\[matched:([^\]]+)\]\s*/;

/**
 * Parse the note text into an ordered list of non-blank lines.
 * Each line carries its original index in the full split array.
 */
export function parseNoteLines(text: string): NoteLine[] {
  const allLines = text.split("\n");
  const result: NoteLine[] = [];
  for (let i = 0; i < allLines.length; i++) {
    const raw = allLines[i];
    if (raw.trim() === "") continue;
    const resolved = raw.startsWith(RESOLVED_PREFIX);
    if (resolved) {
      const afterPrefix = raw.slice(RESOLVED_PREFIX.length);
      const match = afterPrefix.match(MATCHED_TAG_RE);
      if (match) {
        result.push({
          index: i,
          text: afterPrefix.slice(match[0].length),
          resolved: true,
          matchedIdeaId: match[1],
        });
      } else {
        result.push({
          index: i,
          text: afterPrefix,
          resolved: true,
        });
      }
    } else {
      result.push({
        index: i,
        text: raw,
        resolved: false,
      });
    }
  }
  return result;
}

/**
 * Mark a line as resolved by prepending '✓ ' (idempotent).
 * If matchedIdeaId is provided, encodes it as '[matched:<id>] ' after the checkmark.
 * Returns the updated full text.
 */
export function markLineResolved(text: string, index: number, matchedIdeaId?: string): string {
  const lines = text.split("\n");
  const line = lines[index];
  if (line === undefined) return text;
  if (line.startsWith(RESOLVED_PREFIX)) return text;
  const tag = matchedIdeaId ? `[matched:${matchedIdeaId}] ` : "";
  lines[index] = RESOLVED_PREFIX + tag + line;
  return lines.join("\n");
}

/**
 * Replace the content of a line at the given index.
 * Returns the updated full text.
 */
export function replaceLine(text: string, index: number, newText: string): string {
  const lines = text.split("\n");
  if (index < 0 || index >= lines.length) return text;
  lines[index] = newText;
  return lines.join("\n");
}

/**
 * Count the number of non-blank, unresolved lines.
 */
export function unresolvedNonEmptyCount(text: string): number {
  return parseNoteLines(text).filter((l) => !l.resolved && l.text.trim() !== "").length;
}

const DONE_STATUSES: Idea["status"][] = ["completed", "cancelled", "archived"];

/**
 * Find the best matching idea for a given line text.
 * Uses multi-word matching: every word in the query must appear in the idea text.
 * Returns the best match with a confidence score, or null if no good match exists.
 *
 * Score heuristic:
 * - Base: fraction of query words matched (0–1)
 * - Bonus: text similarity (shorter idea texts score higher relative to query)
 * - Penalty: done statuses reduce score by 0.2
 * - Threshold: minimum 0.6 to be considered a match
 */
export function findBestMatch(lineText: string, ideas: Idea[]): MatchResult | null {
  const query = lineText.trim().toLowerCase();
  if (!query) return null;

  const words = query.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  let best: MatchResult | null = null;

  for (const idea of ideas) {
    if (!idea.text) continue;
    if (DONE_STATUSES.includes(idea.status)) continue;

    const ideaText = idea.text.toLowerCase();
    const matchedWords = words.filter((w) => ideaText.includes(w));
    const wordScore = matchedWords.length / words.length;

    if (wordScore < 0.5) continue;

    // Prefer closer length match: ratio of query length to idea length
    const lengthRatio =
      Math.min(query.length, ideaText.length) / Math.max(query.length, ideaText.length);
    const score = wordScore * 0.7 + lengthRatio * 0.3;

    if (score >= 0.6 && (!best || score > best.score)) {
      best = { idea, score };
    }
  }

  return best;
}

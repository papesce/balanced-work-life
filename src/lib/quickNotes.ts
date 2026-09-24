/**
 * Pure functions for Quick Note text manipulation.
 *
 * The raw note text is the single source of truth. A line is considered
 * "resolved" if and only if it starts with the two-character sequence
 * U+2713 (✓) followed by one space. An optional `[matched:<ideaId>]`
 * tag may follow the checkmark to record which idea was matched.
 *
 * Task syntax:
 * - Only lines starting with `- ` (after optional leading whitespace) are
 *   actionable tasks. All other non-blank lines are ignored for processing
 *   (free-form context, not ideas).
 * - A task may carry notes via markdown-link syntax: `[title](notes)`.
 *   On creation, `title` becomes the idea text and `notes` the idea notes.
 * - A task may carry a trailing type hashtag: `#project`, `#task`,
 *   `#goal` (→ objective), `#idea`, `#initiative` (case-insensitive).
 *   Untagged tasks default to `idea`. Unknown trailing tags stay literal.
 */

import type { Idea, IdeaType } from "@/lib/types";

export interface NoteLine {
  /** Original index in the full newline-split array (excluding blank lines). */
  index: number;
  /**
   * Task content with the `- ` prefix stripped but markdown-link syntax kept
   * verbatim (e.g. `[Buy milk](2L whole)`). For non-actionable lines this is
   * the raw trimmed content.
   */
  text: string;
  /** Whether this line is resolved (starts with '✓ '). */
  resolved: boolean;
  /** If this line was resolved via "Match existing", the matched idea ID. */
  matchedIdeaId?: string;
  /** True only for `- ` lines (the only lines that become ideas). */
  actionable: boolean;
  /** Parsed idea title (`[title](notes)` → `title`, `#tag` stripped, else `text`). */
  title: string;
  /** Parsed idea notes (`[title](notes)` → `notes`, else null). */
  detail: string | null;
  /** Parsed idea type from a trailing hashtag (null = untagged → `idea`). */
  kind: IdeaType | null;
}

export type ConfidenceTier = "high" | "medium";

export interface MatchResult {
  idea: Idea;
  score: number;
  tier: ConfidenceTier;
}

const RESOLVED_PREFIX = "✓ ";
const MATCHED_TAG_RE = /^\[matched:([^\]]+)\]\s*/;
const TASK_PREFIX_RE = /^\s*-\s?/;
const TASK_SYNTAX_RE = /\[([^\]]+)\]\(([^)]+)\)/;
const TYPE_TAG_RE = /(?:\s|^)#(project|task|goals?|idea|initiative)\s*$/i;

const TYPE_ALIASES: Record<string, IdeaType> = {
  idea: "idea",
  objective: "objective",
  goal: "objective",
  goals: "objective",
  project: "project",
  initiative: "initiative",
  task: "task",
};

/**
 * Split a trailing type hashtag off a task string.
 * Only a trailing `#project|#task|#goal(s)|#idea|#initiative`
 * (case-insensitive) counts — mid-line hashtags stay literal.
 */
export function parseTaskKind(taskText: string): { kind: IdeaType | null; rest: string } {
  const match = taskText.match(TYPE_TAG_RE);
  if (!match) return { kind: null, rest: taskText };
  const key = match[1].toLowerCase();
  const kind = TYPE_ALIASES[key] ?? null;
  if (!kind) return { kind: null, rest: taskText };
  return { kind, rest: taskText.slice(0, match.index).trimEnd() };
}

/** Parse a dash-stripped task string into title + notes + kind. */
export function parseTaskAll(taskText: string): {
  title: string;
  detail: string | null;
  kind: IdeaType | null;
} {
  const { kind, rest } = parseTaskKind(taskText);
  const { title, detail } = parseTaskTitleDetail(rest);
  return { title, detail, kind };
}

/** True when the (unresolved, untagged) line content starts with `- `. */
export function isTaskLine(content: string): boolean {
  return TASK_PREFIX_RE.test(content);
}

/** Strip a leading `- ` (after optional whitespace) if present. */
export function stripTaskPrefix(content: string): string {
  return content.replace(TASK_PREFIX_RE, "");
}

/**
 * Split a task string into title + detail via `[title](notes)` syntax.
 * First match wins; surrounding text is preserved in the title when the
 * whole line isn't a single link (e.g. `Buy [milk](2L)` → title
 * `Buy milk`, detail `2L`). Returns detail=null when no link present.
 */
export function parseTaskTitleDetail(taskText: string): { title: string; detail: string | null } {
  const trimmed = taskText.trim();
  const match = trimmed.match(TASK_SYNTAX_RE);
  if (!match) return { title: trimmed, detail: null };
  const fullMatch = match[0];
  const title = trimmed.replace(fullMatch, `${match[1]}`).replace(/\s+/g, " ").trim();
  const detail = match[2].trim();
  return { title, detail: detail === "" ? null : detail };
}

function toNoteLine(
  index: number,
  content: string,
  resolved: boolean,
  matchedIdeaId?: string,
): NoteLine {
  const actionable = isTaskLine(content);
  const text = actionable ? stripTaskPrefix(content).trim() : content.trim();
  if (!actionable) {
    return {
      index,
      text,
      resolved,
      matchedIdeaId,
      actionable,
      title: text,
      detail: null,
      kind: null,
    };
  }
  const { title, detail, kind } = parseTaskAll(text);
  return { index, text, resolved, matchedIdeaId, actionable, title, detail, kind };
}

/**
 * Parse the note text into an ordered list of non-blank lines.
 * Each line carries its original index in the full split array.
 * Only `- ` lines are actionable (become ideas); other lines are kept
 * with actionable=false so callers can ignore or render them as context.
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
        const content = afterPrefix.slice(match[0].length);
        result.push(toNoteLine(i, content, true, match[1]));
      } else {
        result.push(toNoteLine(i, afterPrefix, true));
      }
    } else {
      result.push(toNoteLine(i, raw, false));
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
 * Count the number of actionable (`- `), non-blank, unresolved lines.
 * Plain non-dash lines are free-form context and never count.
 */
export function unresolvedNonEmptyCount(text: string): number {
  return parseNoteLines(text).filter((l) => !l.resolved && l.actionable && l.title.trim() !== "")
    .length;
}

export function formatAge(isoTimestamp: string, style: "long" | "short" = "long"): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return style === "long" ? `${mins} min ago` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return style === "long" ? `${hrs} hr ago` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return style === "long" ? `${days} day${days === 1 ? "" : "s"} ago` : `${days}d`;
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
      const tier: ConfidenceTier = score >= 0.7 ? "high" : "medium";
      best = { idea, score, tier };
    }
  }

  return best;
}

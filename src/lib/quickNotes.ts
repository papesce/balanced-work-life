/**
 * Pure functions for Quick Note text manipulation.
 *
 * The raw note text is the single source of truth. A line is considered
 * "resolved" if and only if it starts with the two-character sequence
 * U+2713 (✓) followed by one space.
 */

export interface NoteLine {
  /** Original index in the full newline-split array (excluding blank lines). */
  index: number;
  /** Text content without any prefix. */
  text: string;
  /** Whether this line is resolved (starts with '✓ '). */
  resolved: boolean;
}

const RESOLVED_PREFIX = "✓ ";

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
    result.push({
      index: i,
      text: resolved ? raw.slice(RESOLVED_PREFIX.length) : raw,
      resolved,
    });
  }
  return result;
}

/**
 * Mark a line as resolved by prepending '✓ ' (idempotent).
 * Returns the updated full text.
 */
export function markLineResolved(text: string, index: number): string {
  const lines = text.split("\n");
  const line = lines[index];
  if (line === undefined) return text;
  if (line.startsWith(RESOLVED_PREFIX)) return text;
  lines[index] = RESOLVED_PREFIX + line;
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

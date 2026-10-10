/**
 * Backlog alert levels for the Quick Notes FAB badge.
 * Two signals feed one level:
 * - open note count: warning when more than QUICK_NOTE_NOTES_WARN_AT notes,
 * - actionable task sum (`- ` unresolved lines): warning at
 *   QUICK_NOTE_WARN_AT, alert at QUICK_NOTE_ALERT_AT.
 * Red stays reserved for the task backlog (the real urgency); a pile of
 * mostly-prose notes escalates to amber.
 */
export const QUICK_NOTE_WARN_AT = 5;
export const QUICK_NOTE_ALERT_AT = 10;
export const QUICK_NOTE_NOTES_WARN_AT = 5;

export type QuickNoteBacklogLevel = "normal" | "warning" | "alert";

export function quickNoteBacklogLevel(
  totalTasks: number,
  openNoteCount = 0,
): QuickNoteBacklogLevel {
  if (totalTasks >= QUICK_NOTE_ALERT_AT) return "alert";
  if (totalTasks >= QUICK_NOTE_WARN_AT || openNoteCount > QUICK_NOTE_NOTES_WARN_AT)
    return "warning";
  return "normal";
}

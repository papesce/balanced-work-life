"use client";

import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { parseNoteLines, markLineResolved, unresolvedNonEmptyCount } from "@/lib/quickNotes";
import { parseTaskAll, stripTaskPrefix, isTaskLine } from "@/lib/quickNotes";
import type { QuickNote } from "@/lib/types";
import { ideaInsertSql, ideaInsertParams } from "@/lib/ideaInsert";
import type { ResolveAction } from "./types";
import type { QuickNoteDraftApi } from "./draft";
import type { QuickNoteNotes } from "./notes";
import type { QuickNotePersistence } from "./persistence";
import { qnDebug, qnLogQuery, qnInfo, qnWarn } from "./log";

export interface QuickNoteOperations {
  selectNote: (id: string) => Promise<void>;
  createNote: () => Promise<string | null>;
  resolveLine: (index: number, action: ResolveAction) => Promise<void>;
  discardNote: () => Promise<void>;
}

interface OperationsDeps {
  db: AbstractPowerSyncDatabase;
  userId: string;
  notes: QuickNoteNotes;
  draft: QuickNoteDraftApi;
  persistence: QuickNotePersistence;
  registerUndo: (action: { label: string; run: () => Promise<void> }) => void;
}

type Tx = {
  execute: (sql: string, params?: unknown[]) => Promise<unknown>;
  getAll: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
};

/** Insert an idea row with quick-note defaults (status draft, no scheduling). */
function insertQuickNoteIdea(
  tx: Tx,
  opts: {
    userId: string;
    parentId: string | null;
    text: string;
    notes: string | null;
    type: string | null;
    sortOrder: number;
    now: string;
  },
): Promise<string> {
  const id = uuidv4();
  return tx
    .execute(
      ideaInsertSql(),
      ideaInsertParams({
        id,
        user_id: opts.userId,
        parent_id: opts.parentId,
        text: opts.text,
        description: null,
        type: opts.type ?? "idea",
        effort: null,
        impact: null,
        urgency: null,
        scheduled_date: null,
        scheduled_time: null,
        duration_minutes: null,
        is_priority: false,
        priority_order: null,
        status: "draft",
        notes: opts.notes,
        completed_at: null,
        cancelled_at: null,
        paused_at: null,
        attempt_dates: [],
        status_history: null,
        horizon: null,
        focus_lane: null,
        in_focus: false,
        in_focus_until: null,
        productivity_signal: null,
        sort_order: opts.sortOrder,
        created_at: opts.now,
        updated_at: opts.now,
      }),
    )
    .then(() => id);
}

/**
 * Note-level operations: switching, creating, resolving lines, discarding.
 * All persistence funnels through the single `persistDraft` implementation —
 * these functions only orchestrate (flush-before-switch, provenance updates).
 */
export function useQuickNoteOperations({
  db,
  userId,
  notes,
  draft,
  persistence,
  registerUndo,
}: OperationsDeps): QuickNoteOperations {
  // Shared pre-switch flush: persist unsaved text before abandoning the
  // draft. Aborts the switch on failure, keeping the user's text in place.
  const flushBeforeSwitch = useCallback(
    async (origin: "select" | "create"): Promise<boolean> => {
      persistence.cancelAutosave();
      if (!draft.dirtyRef.current) {
        draft.setDirty(false);
        return true;
      }
      persistence.markSaving();
      const ok = await persistence.persistDraft(draft.draftRef.current, origin);
      // Preserve dirty only when there is actual unsaved content.
      draft.setDirty(ok ? false : draft.draftRef.current !== draft.baseTextRef.current);
      return ok;
    },
    [persistence, draft],
  );

  const selectNote = useCallback(
    async (id: string) => {
      if (!(await flushBeforeSwitch("select"))) return;
      notes.setSelectedNoteId(id);
      const target = notes.allNotes.find((n) => n.id === id);
      if (target) {
        qnInfo(
          `selectNote: switching to id=${id}, setting draft len=${target.text?.length ?? 0} from DB row`,
        );
        draft.load(target.id, target.text);
        persistence.markIdle(target.updated_at ?? null);
      } else {
        qnWarn(
          `selectNote: id=${id} NOT FOUND in allNotes (${notes.allNotes.length} rows) — draft left untouched (len=${draft.draftRef.current.length})`,
        );
      }
    },
    [flushBeforeSwitch, notes, draft, persistence],
  );

  const createNote = useCallback(async () => {
    if (!userId) return null;
    if (!(await flushBeforeSwitch("create"))) return null;
    const id = uuidv4();
    const now = new Date().toISOString();
    try {
      const params = [id, userId, "", "open", now, now];
      qnLogQuery(
        "start",
        `createNote: blank note id=${id}`,
        "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        params,
      );
      await db.execute(
        "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        params,
      );
      qnLogQuery("ok", "createNote: blank note", "", []);
    } catch (err) {
      qnDebug("createNote: FAILED", err);
      persistence.markError();
      draft.setDirty(draft.draftRef.current !== draft.baseTextRef.current);
      return null;
    }
    persistence.resetPending();
    draft.clearWriteState();
    notes.setSelectedNoteId(id);
    draft.load(id, "");
    persistence.markIdle(null);
    return id;
  }, [db, userId, flushBeforeSwitch, notes, draft, persistence]);

  const resolveLine = useCallback(
    async (index: number, action: ResolveAction) => {
      const note: QuickNote | null = notes.note;
      if (!note) return;

      // Validate BEFORE flushing: a missing/already-resolved line must not
      // touch dirty state (previously the flush ran first, then a silent
      // no-op left save state inconsistent).
      const preLines = parseNoteLines(draft.draftRef.current);
      const preTarget = preLines.find((l) => l.index === index);
      if (!preTarget || preTarget.resolved || !preTarget.actionable) return;

      let resultText: string | null = null;
      let didArchive = false;
      let ideaIdToDelete: string | null = null;

      await db.writeTransaction(async (tx) => {
        // 1. Flush the draft into the note as the first statement.
        // (In-transaction by necessity — atomic with the resolve. This is the
        // only write not going through persistDraft, because that helper
        // cannot run inside a caller-owned transaction.)
        if (draft.dirtyRef.current) {
          const now = new Date().toISOString();
          const params = [draft.draftRef.current, now, note.id];
          qnLogQuery(
            "start",
            `resolveLine: flush draft id=${note.id} len=${draft.draftRef.current.length}`,
            "UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?",
            params,
          );
          await tx.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", params);
          qnLogQuery("ok", "resolveLine: flush draft", "", []);
          draft.setDirty(false);
        }

        // 2. Use the current draft directly (avoids stale read from DB)
        const currentText = draft.draftRef.current;

        const lines = parseNoteLines(currentText);
        const target = lines.find((l) => l.index === index);

        // 3. Guard: line missing or already resolved (re-checked post-flush
        // to cover races with concurrent edits).
        // NOTE: the old strict `target.text !== expectedText` check caused
        // silent no-ops (notably on the last line) when the row's prop was
        // stale vs. the flushed draft. The draft is authoritative — proceed
        // with the current text and only warn on mismatch.
        if (!target || target.resolved || !target.actionable) return;
        if (target.text !== action.expectedText) {
          qnWarn(
            `resolveLine text mismatch — proceeding with current draft (index=${index}, expected=${JSON.stringify(action.expectedText)?.slice(0, 100)}, actual=${JSON.stringify(target.text)?.slice(0, 100)})`,
          );
        }

        // 4. Side effects
        if (action.type === "create" || action.type === "create_under") {
          const parentId = action.type === "create_under" ? action.parentId : null;
          const maxRow = await tx.getAll<{ max_order: number | null }>(
            "SELECT MAX(sort_order) AS max_order FROM ideas WHERE user_id = ? AND parent_id IS ?",
            [userId, parentId],
          );
          const sortOrder = (maxRow[0]?.max_order ?? -1) + 1;
          const now = new Date().toISOString();
          // The edited text may still carry the `- ` prefix, `[title](notes)`
          // syntax, and/or a trailing `#type` hashtag — normalize to title +
          // notes + type so the idea row holds clean values.
          const rawTask = isTaskLine(action.text) ? stripTaskPrefix(action.text) : action.text;
          const { title, detail, kind } = parseTaskAll(rawTask);
          const id = await insertQuickNoteIdea(tx, {
            userId,
            parentId,
            text: title.trim(),
            notes: detail,
            type: kind ?? "idea",
            sortOrder,
            now,
          });
          ideaIdToDelete = id;
        }

        // 5. Mark line resolved
        const matchedId = action.type === "match" ? action.ideaId : undefined;
        const newText = markLineResolved(currentText, index, matchedId);
        const now = new Date().toISOString();

        // 6. Check if any unresolved non-empty lines remain
        const remaining = unresolvedNonEmptyCount(newText);
        const hasResolved = parseNoteLines(newText).some((l) => l.resolved);

        if (remaining === 0 && hasResolved) {
          didArchive = true;
          const params = [newText, now, now, note.id];
          qnLogQuery(
            "start",
            `resolveLine: ARCHIVE note id=${note.id}`,
            "UPDATE quick_notes SET text = ?, status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?",
            params,
          );
          await tx.execute(
            "UPDATE quick_notes SET text = ?, status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?",
            params,
          );
          qnLogQuery("ok", "resolveLine: ARCHIVE note", "", []);
        } else {
          const params = [newText, now, note.id];
          qnLogQuery(
            "start",
            `resolveLine: mark line ${index} resolved id=${note.id} action=${action.type}`,
            "UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?",
            params,
          );
          await tx.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", params);
          qnLogQuery("ok", "resolveLine: mark line resolved", "", []);
        }

        resultText = newText;
      });

      // 7. Only update draft if the transaction succeeded.
      // load() clears dirty and refreshes provenance atomically.
      if (resultText !== null) {
        draft.load(note.id, resultText);

        // 8. Register undo — ONE writeTransaction
        const capturedNoteId = note.id;
        const capturedIdeaId = ideaIdToDelete;
        const capturedIndex = index;
        const capturedDidArchive = didArchive;
        const undoLabel = didArchive
          ? "Note archived"
          : action.type === "create" || action.type === "create_under"
            ? "Idea created"
            : action.type === "match"
              ? "Idea matched"
              : "Line discarded";

        registerUndo({
          label: undoLabel,
          run: async () => {
            await db.writeTransaction(async (uTx) => {
              const uRows = await uTx.getAll<{ text: string; status: string }>(
                "SELECT text, status FROM quick_notes WHERE id = ?",
                [capturedNoteId],
              );
              if (uRows.length === 0) return;
              const uText = uRows[0].text;
              const uLines = uText.split("\n");
              const uLine = uLines[capturedIndex];
              // Only remove prefix if the line still starts with it
              // Handles both "✓ text" and "✓ [matched:id] text"
              if (uLine && uLine.startsWith("✓ ")) {
                const afterCheck = uLine.slice(2);
                const tagMatch = afterCheck.match(/^\[matched:[^\]]+\]\s*/);
                uLines[capturedIndex] = tagMatch
                  ? afterCheck.slice(tagMatch[0].length)
                  : afterCheck;
              }
              const now = new Date().toISOString();
              if (capturedDidArchive) {
                await uTx.execute(
                  "UPDATE quick_notes SET text = ?, status = 'open', archived_at = NULL, updated_at = ? WHERE id = ?",
                  [uLines.join("\n"), now, capturedNoteId],
                );
              } else {
                await uTx.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", [
                  uLines.join("\n"),
                  now,
                  capturedNoteId,
                ]);
              }
            });
            // Delete created idea (outside transaction)
            if (capturedIdeaId) {
              await db.execute("DELETE FROM ideas WHERE id = ?", [capturedIdeaId]);
            }
          },
        });
      }
    },
    [notes, db, userId, draft, registerUndo],
  );

  const discardNote = useCallback(async () => {
    persistence.cancelAutosave();
    const existing = notes.noteRef.current;
    if (!existing) {
      persistence.resetPending();
      draft.reset();
      persistence.markIdle(null);
      return;
    }
    const capturedNoteId = existing.id;
    const now = new Date().toISOString();
    const discardParams = [now, now, capturedNoteId];
    qnLogQuery(
      "start",
      `discardNote: soft-delete id=${capturedNoteId}`,
      "UPDATE quick_notes SET deleted_at = ?, updated_at = ? WHERE id = ?",
      discardParams,
    );
    await db.execute(
      "UPDATE quick_notes SET deleted_at = ?, updated_at = ? WHERE id = ?",
      discardParams,
    );
    qnLogQuery("ok", "discardNote: soft-delete", "", []);
    // Drop local edit state AFTER the delete so a trailing flush can't
    // resurrect the row. Undo restores the last-saved text, not the
    // unsaved keystrokes — the confirm step in the panel makes this explicit.
    // (Draft text itself is intentionally kept: the panel closes right after.)
    draft.detach();
    persistence.resetPending();
    registerUndo({
      label: "Note discarded",
      run: async () => {
        await db.execute(
          "UPDATE quick_notes SET deleted_at = NULL, status = 'open', updated_at = ? WHERE id = ?",
          [new Date().toISOString(), capturedNoteId],
        );
      },
    });
  }, [db, notes, draft, persistence, registerUndo]);

  return { selectNote, createNote, resolveLine, discardNote };
}

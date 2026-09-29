"use client";

import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { parseTaskAll, stripTaskPrefix, isTaskLine } from "@/lib/quickNotes";
import { ideaInsertSql, ideaInsertParams } from "@/lib/ideaInsert";
import type { QuickNoteDraftApi } from "./draft";
import type { QuickNoteNotes } from "./notes";
import type { QuickNotePersistence } from "./persistence";
import { qnDebug, qnLogQuery, qnInfo, qnWarn } from "./log";

export interface QuickNoteOperations {
  selectNote: (id: string) => Promise<void>;
  createNote: () => Promise<string | null>;
  /** Create an idea from arbitrary selected text. Never mutates note text. */
  createSelectionIdea: (text: string, parentId?: string | null) => Promise<string | null>;
  discardNote: () => Promise<void>;
  /** Flip an archived note back to open. No-op when the selected note isn't archived. */
  reopenNote: () => Promise<void>;
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

  /**
   * Create an idea from arbitrary selected text. Multi-line selections use
   * the first line as title (with `[title](notes)` + trailing `#type`
   * honored) and the rest as notes detail. Never mutates note text, so no
   * line resolution or archiving happens here.
   */
  const createSelectionIdea = useCallback(
    async (text: string, parentId: string | null = null): Promise<string | null> => {
      if (!userId) return null;
      const rawTask = isTaskLine(text) ? stripTaskPrefix(text) : text;
      const taskLines = rawTask
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (taskLines.length === 0) return null;
      const { title, detail, kind } = parseTaskAll(taskLines[0]);
      const rest = taskLines.slice(1).join("\n");
      const cleanTitle = title.trim();
      if (!cleanTitle) return null;
      const combinedNotes = [detail, rest].filter(Boolean).join("\n") || null;

      let createdId: string | null = null;
      await db.writeTransaction(async (tx) => {
        const maxRow = await tx.getAll<{ max_order: number | null }>(
          "SELECT MAX(sort_order) AS max_order FROM ideas WHERE user_id = ? AND parent_id IS ?",
          [userId, parentId],
        );
        const now = new Date().toISOString();
        createdId = await insertQuickNoteIdea(tx, {
          userId,
          parentId,
          text: cleanTitle,
          notes: combinedNotes,
          type: kind ?? "idea",
          sortOrder: (maxRow[0]?.max_order ?? -1) + 1,
          now,
        });
      });
      if (createdId) {
        const capturedId: string = createdId;
        registerUndo({
          label: "Idea created",
          run: async () => {
            await db.execute("DELETE FROM ideas WHERE id = ?", [capturedId]);
          },
        });
      }
      return createdId;
    },
    [db, userId, registerUndo],
  );

  const reopenNote = useCallback(async () => {
    const selected = notes.selectedNote;
    if (!selected || selected.status !== "archived") return;
    const capturedNoteId = selected.id;
    const now = new Date().toISOString();
    await db.execute(
      "UPDATE quick_notes SET status = 'open', archived_at = NULL, updated_at = ? WHERE id = ?",
      [now, capturedNoteId],
    );
    registerUndo({
      label: "Note reopened",
      run: async () => {
        const at = new Date().toISOString();
        await db.execute(
          "UPDATE quick_notes SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?",
          [at, at, capturedNoteId],
        );
      },
    });
  }, [db, notes, registerUndo]);

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

  return { selectNote, createNote, createSelectionIdea, discardNote, reopenNote };
}

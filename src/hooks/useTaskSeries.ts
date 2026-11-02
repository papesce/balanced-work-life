"use client";

import { useMemo } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "./useAuth";
import { DONE_STATUSES } from "@/lib/ideaSearch";
import { deserializeIdea } from "@/lib/ideaModel";
import { ideaInsertParams, ideaInsertSql } from "@/lib/ideaInsert";
import { isUnlinkedPastTaskOccurrence, seriesIdForAdoption } from "@/lib/tasks/series";
import type { Idea } from "@/lib/types";

type SeriesParentRow = Pick<Idea, "id" | "series_id" | "parent_id">;
type AttachableOccurrenceRow = Pick<
  Idea,
  "id" | "series_id" | "type" | "status" | "completed_at" | "created_at"
>;

export function useTaskSeries(seriesIds: string[]) {
  const db = usePowerSync();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const uniqueSeriesIds = useMemo(() => [...new Set(seriesIds)], [seriesIds]);
  const query = uniqueSeriesIds.length
    ? `SELECT * FROM ideas WHERE user_id = ? AND series_id IN (${uniqueSeriesIds.map(() => "?").join(",")})
       AND status NOT IN ('completed', 'cancelled', 'missed', 'archived')`
    : "SELECT * FROM ideas WHERE 0";
  const { data: rawOpenInstances } = useQuery<Record<string, unknown>>(
    query,
    uniqueSeriesIds.length ? [userId, ...uniqueSeriesIds] : [],
  );
  const openInstances = useMemo(() => rawOpenInstances.map(deserializeIdea), [rawOpenInstances]);

  const createOccurrence = async (previous: Idea, text: string): Promise<string> => {
    if (!userId) return "";
    const trimmed = text.trim();
    if (!trimmed) return "";
    const now = new Date().toISOString();
    const id = uuidv4();

    await db.writeTransaction(async (tx) => {
      const source = await tx.getOptional<SeriesParentRow>(
        "SELECT id, series_id, parent_id FROM ideas WHERE id = ? AND user_id = ?",
        [previous.id, userId],
      );
      if (!source) throw new Error("Cannot repeat a task that no longer exists.");

      // Adopting different legacy occurrences on separate devices can create
      // separate series. There is intentionally no series merge operation.
      // Re-adopting an unlinked first instance uses its own ID and rejoins it.
      const seriesId = seriesIdForAdoption(source);
      let parentId: string | null = null;
      if (source.parent_id) {
        const parent = await tx.getOptional<{ id: string; status: Idea["status"] }>(
          "SELECT id, status FROM ideas WHERE id = ? AND user_id = ?",
          [source.parent_id, userId],
        );
        if (parent && !DONE_STATUSES.includes(parent.status)) parentId = parent.id;
      }

      const tagRows = await tx.getAll<{ tag_id: string }>(
        "SELECT tag_id FROM task_tags WHERE idea_id = ?",
        [previous.id],
      );
      const orderRow = await tx.getOptional<{ max_order: number }>(
        "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM ideas WHERE user_id = ? AND parent_id IS ?",
        [userId, parentId],
      );

      await tx.execute("UPDATE ideas SET series_id = ?, updated_at = ? WHERE id = ?", [
        seriesId,
        now,
        previous.id,
      ]);

      await tx.execute(
        ideaInsertSql(),
        ideaInsertParams({
          id,
          user_id: userId,
          parent_id: parentId,
          series_id: seriesId,
          text: trimmed,
          description: null,
          type: "task",
          effort: null,
          impact: null,
          urgency: null,
          scheduled_date: null,
          scheduled_time: null,
          duration_minutes: null,
          is_priority: false,
          priority_order: null,
          status: "draft",
          notes: null,
          why: null,
          completed_at: null,
          cancelled_at: null,
          paused_at: null,
          attempt_dates: [],
          status_history: null,
          productivity_signal: null,
          sort_order: (orderRow?.max_order ?? -1) + 1,
          created_at: now,
          updated_at: now,
        }),
      );

      for (const tag of tagRows) {
        await tx.execute("INSERT INTO task_tags (id, idea_id, tag_id) VALUES (?,?,?)", [
          uuidv4(),
          id,
          tag.tag_id,
        ]);
      }
    });

    return id;
  };

  const attachOccurrence = async (currentId: string, occurrenceId: string): Promise<void> => {
    if (!userId) throw new Error("Cannot attach an occurrence without an authenticated user.");
    if (currentId === occurrenceId) throw new Error("A task cannot be attached to itself.");

    await db.writeTransaction(async (tx) => {
      const current = await tx.getOptional<AttachableOccurrenceRow>(
        "SELECT id, series_id, type, status, completed_at, created_at FROM ideas WHERE id = ? AND user_id = ?",
        [currentId, userId],
      );
      if (!current || current.type !== "task") {
        throw new Error("Cannot attach an occurrence to a task that no longer exists.");
      }

      const occurrence = await tx.getOptional<AttachableOccurrenceRow>(
        "SELECT id, series_id, type, status, completed_at, created_at FROM ideas WHERE id = ? AND user_id = ?",
        [occurrenceId, userId],
      );
      if (!occurrence || !isUnlinkedPastTaskOccurrence(occurrence, current)) {
        throw new Error("This past task is no longer available to attach.");
      }

      const seriesId = seriesIdForAdoption(current);
      const now = new Date().toISOString();
      if (current.series_id === null) {
        const updatedCurrent = await tx.execute(
          "UPDATE ideas SET series_id = ?, updated_at = ? WHERE id = ? AND user_id = ? AND series_id IS NULL",
          [seriesId, now, currentId, userId],
        );
        if (updatedCurrent.rowsAffected === 0) {
          throw new Error("The task series changed before the occurrence could be attached.");
        }
      }

      const updatedOccurrence = await tx.execute(
        "UPDATE ideas SET series_id = ?, updated_at = ? WHERE id = ? AND user_id = ? AND series_id IS NULL",
        [seriesId, now, occurrenceId, userId],
      );
      if (updatedOccurrence.rowsAffected === 0) {
        throw new Error("This past task is no longer available to attach.");
      }
    });
  };

  return { openInstances, createOccurrence, attachOccurrence };
}

"use client";

import { useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { LaneConfig, HorizonSetting, IdeaHorizon } from "@/lib/types";
import { DEFAULT_UNASSIGNED_LABEL } from "@/lib/constants";

export function useLaneConfigs() {
  const { user } = useAuth();
  const db = usePowerSync();
  const userId = user?.id ?? "";

  const { data: laneRows, isLoading: lanesLoading } = useQuery<Record<string, unknown>>(
    userId
      ? "SELECT * FROM lane_configs WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC"
      : "SELECT * FROM lane_configs WHERE 0",
    userId ? [userId] : [],
  );
  const { data: settingRows, isLoading: settingsLoading } = useQuery<Record<string, unknown>>(
    userId
      ? "SELECT * FROM horizon_settings WHERE user_id = ?"
      : "SELECT * FROM horizon_settings WHERE 0",
    userId ? [userId] : [],
  );

  const isLoading = lanesLoading || settingsLoading;

  const laneConfigs: LaneConfig[] = useMemo(
    () => (laneRows as unknown as LaneConfig[]) ?? [],
    [laneRows],
  );
  const horizonSettings: HorizonSetting[] = useMemo(
    () => (settingRows as unknown as HorizonSetting[]) ?? [],
    [settingRows],
  );

  const getLanesForHorizon = (horizon: IdeaHorizon): LaneConfig[] =>
    laneConfigs.filter((l) => l.horizon === horizon);

  const getUnassignedLabel = (horizon: IdeaHorizon): string => {
    const s = horizonSettings.find((x) => x.horizon === horizon);
    return s?.unassigned_label ?? DEFAULT_UNASSIGNED_LABEL;
  };

  // Hybrid: instant client validation for UX, DB UNIQUE is enforcement
  const createLane = async (horizon: IdeaHorizon, label: string) => {
    if (!user || isLoading) return null;
    const existing = getLanesForHorizon(horizon);
    if (existing.length >= 5) return null;
    if (existing.some((l) => l.label.toLowerCase() === label.toLowerCase())) return null;
    const id = uuidv4();
    const maxSort = existing.reduce((max, l) => Math.max(max, l.sort_order), -1);
    await db.execute(
      `INSERT INTO lane_configs (id, user_id, horizon, label, sort_order, created_at) VALUES (?,?,?,?,?,?)`,
      [id, user.id, horizon, label, maxSort + 1, new Date().toISOString()],
    );
    return id;
  };

  const updateLaneLabel = async (laneId: string, label: string) => {
    if (isLoading) return;
    await db.execute(`UPDATE lane_configs SET label = ? WHERE id = ?`, [label, laneId]);
  };

  const deleteLane = async (laneId: string, moveToUnassigned = false) => {
    const count = await db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM ideas WHERE focus_lane = ?`,
      [laneId],
    );
    if (count && count.c > 0) {
      if (!moveToUnassigned) return false;
      await db.execute(`UPDATE ideas SET focus_lane = NULL WHERE focus_lane = ?`, [laneId]);
    }
    await db.execute(`DELETE FROM lane_configs WHERE id = ?`, [laneId]);
    return true;
  };

  const moveLane = async (laneId: string, direction: "up" | "down") => {
    if (isLoading) return;
    const lane = laneConfigs.find((l) => l.id === laneId);
    if (!lane) return;
    const siblings = getLanesForHorizon(lane.horizon);
    const idx = siblings.findIndex((l) => l.id === laneId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];
    await db.execute(`UPDATE lane_configs SET sort_order = ? WHERE id = ?`, [
      other.sort_order,
      lane.id,
    ]);
    await db.execute(`UPDATE lane_configs SET sort_order = ? WHERE id = ?`, [
      lane.sort_order,
      other.id,
    ]);
  };

  const reorderLanes = async (orderedIds: string[]) => {
    if (isLoading) return;
    for (let i = 0; i < orderedIds.length; i++) {
      await db.execute(`UPDATE lane_configs SET sort_order = ? WHERE id = ?`, [i, orderedIds[i]]);
    }
  };

  const setUnassignedLabel = async (horizon: IdeaHorizon, label: string) => {
    if (!user) return;
    const existing = await db.getOptional<{ id: string }>(
      `SELECT id FROM horizon_settings WHERE user_id = ? AND horizon = ? LIMIT 1`,
      [user.id, horizon],
    );
    if (existing) {
      await db.execute(`UPDATE horizon_settings SET unassigned_label = ? WHERE id = ?`, [
        label,
        existing.id,
      ]);
    } else {
      const id = uuidv4();
      await db.execute(
        `INSERT INTO horizon_settings (id, user_id, horizon, unassigned_label) VALUES (?,?,?,?)`,
        [id, user.id, horizon, label],
      );
    }
  };

  return {
    laneConfigs,
    horizonSettings,
    isLoading,
    getLanesForHorizon,
    getUnassignedLabel,
    createLane,
    updateLaneLabel,
    deleteLane,
    moveLane,
    reorderLanes,
    setUnassignedLabel,
  };
}

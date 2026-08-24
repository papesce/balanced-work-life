"use client";

import { useState } from "react";
import { Trash2, Plus, X } from "lucide-react";
import { IdeaHorizon } from "@/lib/types";
import { useLaneConfigsContext } from "@/contexts/LaneConfigsContext";

export function LaneConfigDialog({
  horizon,
  onClose,
  ideasCountByLane,
}: {
  horizon: IdeaHorizon;
  onClose: () => void;
  ideasCountByLane: (laneId: string) => number;
}) {
  const {
    isLoading,
    getLanesForHorizon,
    getUnassignedLabel,
    createLane,
    updateLaneLabel,
    deleteLane,
    setUnassignedLabel,
  } = useLaneConfigsContext();
  const lanes = getLanesForHorizon(horizon);
  const unassignedLabel = getUnassignedLabel(horizon);

  const [localUnassigned, setLocalUnassigned] = useState(unassignedLabel);
  const [savingUnassigned, setSavingUnassigned] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const handleSaveUnassigned = async () => {
    if (savingUnassigned) return;
    const v = localUnassigned.trim();
    if (!v || v === unassignedLabel) return;
    setSavingUnassigned(true);
    try {
      await setUnassignedLabel(horizon, v);
    } finally {
      setSavingUnassigned(false);
    }
  };

  const commitEdit = async (laneId: string, currentLabel: string) => {
    const v = editingValue.trim();
    setEditingId(null);
    if (v && v !== currentLabel) {
      try {
        await updateLaneLabel(laneId, v);
      } catch {
        // label reverts on next render from reactive state
      }
    }
  };

  const [adding, setAdding] = useState(false);
  const handleAdd = async () => {
    if (isLoading || adding) return;
    const v = newLabel.trim();
    if (!v || lanes.length >= 5) return;
    setAdding(true);
    try {
      await createLane(horizon, v);
      setNewLabel("");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (laneId: string) => {
    try {
      await deleteLane(laneId);
    } catch {
      // deletion is blocked server-side; UI state will reflect the lane still exists
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-md rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold capitalize">{horizon} lanes</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-black/5">
            <X size={16} />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Unassigned label{" "}
            {lanes.length === 0 && (
              <span className="text-gray-400">(hidden until a lane exists)</span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              value={localUnassigned}
              onChange={(e) => setLocalUnassigned(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleSaveUnassigned()}
              className="flex-1 rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-white/10"
              maxLength={30}
            />
            <button
              onClick={() => void handleSaveUnassigned()}
              disabled={savingUnassigned}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-10 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
            <div className="h-10 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
            <div className="mt-4 h-9 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {lanes.map((lane) => {
                const count = ideasCountByLane(lane.id);
                const isEditing = editingId === lane.id;
                return (
                  <div
                    key={lane.id}
                    className="flex items-center gap-2 rounded-lg border border-black/5 px-3 py-2 dark:border-white/5"
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => void commitEdit(lane.id, lane.label)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void commitEdit(lane.id, lane.label);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 rounded border border-indigo-300 px-2 py-1 text-sm outline-none"
                        maxLength={30}
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(lane.id);
                          setEditingValue(lane.label);
                        }}
                        className="flex-1 text-left text-sm font-medium hover:text-indigo-600"
                      >
                        {lane.label}{" "}
                        {count > 0 && <span className="text-xs text-gray-400">({count})</span>}
                      </button>
                    )}
                    <button
                      disabled={count > 0}
                      title={count > 0 ? "Move ideas out first" : "Delete lane"}
                      onClick={() => void handleDelete(lane.id)}
                      className={`rounded p-1 ${count > 0 ? "cursor-not-allowed text-gray-300" : "text-red-400 hover:bg-red-50 hover:text-red-600"}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            {lanes.length < 5 ? (
              <div className="mt-4 flex gap-2">
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
                  placeholder="New lane label"
                  maxLength={30}
                  disabled={adding}
                  className="flex-1 rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-white/10"
                />
                <button
                  onClick={() => void handleAdd()}
                  disabled={!newLabel.trim() || adding}
                  className="flex items-center gap-1 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80 disabled:opacity-40"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            ) : (
              <p className="mt-4 text-center text-xs text-gray-400">Max 5 lanes reached</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

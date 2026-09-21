"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useLaneConfigsContext } from "@/contexts/LaneConfigsContext";
import { useIdeas } from "@/hooks/useIdeas";
import { LaneConfigPanel } from "@/components/horizon/LaneConfigPanel";
import { IdeaHorizon } from "@/lib/types";

const HORIZONS: { key: IdeaHorizon; label: string }[] = [
  { key: "short", label: "Short term" },
  { key: "medium", label: "Medium term" },
  { key: "long", label: "Long term" },
];

export default function LanesSettingsPage() {
  const { getLanesForHorizon, getUnassignedLabel, isLoading } = useLaneConfigsContext();
  const { ideas } = useIdeas();
  const [dialogHorizon, setDialogHorizon] = useState<IdeaHorizon | null>(null);

  return (
    <AppShell title="Lanes">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200">Horizon Lanes</h2>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            Configure lanes per horizon (0-5). Unassigned is visible only when at least one lane
            exists.
          </p>
        </div>

        <div className="space-y-4">
          {HORIZONS.map((h) => {
            const lanes = getLanesForHorizon(h.key);
            const unassignedLabel = getUnassignedLabel(h.key);
            return (
              <div
                key={h.key}
                className="glass-card rounded-2xl border border-black/5 p-4 dark:border-white/5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold">{h.label}</span>
                  <button
                    onClick={() => setDialogHorizon(h.key)}
                    className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80"
                  >
                    Configure
                  </button>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {isLoading ? (
                    <div className="space-y-2">
                      <div className="h-4 animate-pulse rounded bg-black/5 dark:bg-white/5" />
                      <div className="h-4 animate-pulse rounded bg-black/5 dark:bg-white/5" />
                    </div>
                  ) : lanes.length === 0 ? (
                    <p className="italic">No lanes — unassigned hidden</p>
                  ) : (
                    <ul className="space-y-1">
                      <li className="flex justify-between">
                        <span>{unassignedLabel}</span>
                        <span className="text-gray-400">unassigned</span>
                      </li>
                      {lanes.map((lane) => (
                        <li key={lane.id} className="flex justify-between">
                          <span>{lane.label}</span>
                          <span className="text-gray-400">lane</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {dialogHorizon && (
        <LaneConfigPanel
          key={dialogHorizon}
          horizon={dialogHorizon}
          onClose={() => setDialogHorizon(null)}
          ideasCountByLane={(laneId) =>
            laneId === "unassigned"
              ? ideas.filter((i) => i.focus_lane == null).length
              : ideas.filter((i) => i.focus_lane === laneId).length
          }
        />
      )}
    </AppShell>
  );
}

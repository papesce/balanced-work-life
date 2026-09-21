"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, StickyNote, Telescope, ChevronDown, ChevronRight, Check } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useLaneConfigsContext } from "@/contexts/LaneConfigsContext";
import { getRevealHref } from "@/lib/reveal";
import { IdeaHorizon } from "@/lib/types";
import { DEFAULT_UNASSIGNED_LABEL } from "@/lib/constants";
import { DetailsEditor } from "./DetailsEditor";

const HORIZON_LABELS: Record<IdeaHorizon, string> = {
  short: "Short-term",
  medium: "Medium-term",
  long: "Long-term",
};

export function DetailsDrawer({ ideaId, onClose }: { ideaId: string | null; onClose: () => void }) {
  const { ideas, updateIdea } = useIdeas();
  const idea = ideaId ? (ideas.find((i) => i.id === ideaId) ?? null) : null;
  const [mounted, setMounted] = useState(false);
  const [horizonOpen, setHorizonOpen] = useState(false);
  const router = useRouter();
  const { laneConfigs, getLanesForHorizon, getUnassignedLabel } = useLaneConfigsContext();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!ideaId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [ideaId, onClose]);

  if (!mounted || !ideaId || !idea) return null;

  const handleSave = async (next: string | null) => {
    await updateIdea(ideaId, { notes: next });
  };

  const handleSetHorizon = async (h: IdeaHorizon | null) => {
    await updateIdea(ideaId, { horizon: h });
  };

  const handleSetLane = async (laneId: string | null) => {
    await updateIdea(ideaId, { focus_lane: laneId });
  };

  const horizonLanes = idea.horizon ? getLanesForHorizon(idea.horizon) : [];
  const unassignedLabel = idea.horizon
    ? getUnassignedLabel(idea.horizon)
    : DEFAULT_UNASSIGNED_LABEL;

  const currentLaneLabel = idea.horizon
    ? idea.focus_lane
      ? (laneConfigs.find((l) => l.id === idea.focus_lane)?.label ?? "Unknown")
      : unassignedLabel
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex h-full w-full max-w-[420px] flex-col bg-white shadow-xl sm:w-[420px] dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/5">
          <div className="flex items-center gap-2">
            <StickyNote size={16} className="text-indigo-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Details</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p
            className="mb-3 truncate text-xs font-medium text-gray-500 dark:text-gray-400"
            title={idea.text}
          >
            {idea.text || "Untitled"}
          </p>

          {/* Horizon Section */}
          <div className="mb-4 rounded-lg border border-black/5 dark:border-white/5">
            <button
              onClick={() => setHorizonOpen(!horizonOpen)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              <Telescope size={14} className="text-indigo-500" />
              <span className="flex-1">Horizon</span>
              <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                {idea.horizon ? (
                  <>
                    <span>{HORIZON_LABELS[idea.horizon]}</span>
                    {currentLaneLabel && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span>{currentLaneLabel}</span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="italic">Not assigned</span>
                )}
                {horizonOpen ? (
                  <ChevronDown size={12} strokeWidth={1.5} />
                ) : (
                  <ChevronRight size={12} strokeWidth={1.5} />
                )}
              </span>
            </button>

            {horizonOpen && (
              <div className="border-t border-black/5 px-3 py-2 dark:border-white/5">
                {/* Horizon picker */}
                <p className="mb-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
                  Horizon
                </p>
                <div className="mb-2">
                  {(["short", "medium", "long"] as IdeaHorizon[]).map((h) => (
                    <button
                      key={h}
                      onClick={() => handleSetHorizon(h)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-600 hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.04]"
                    >
                      <span className="w-4">
                        {idea.horizon === h && (
                          <Check size={12} strokeWidth={2} className="text-indigo-500" />
                        )}
                      </span>
                      {HORIZON_LABELS[h]}
                    </button>
                  ))}
                  {idea.horizon != null && (
                    <>
                      <div className="my-1 border-t border-black/5 dark:border-white/5" />
                      <button
                        onClick={() => handleSetHorizon(null)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-600 hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.04]"
                      >
                        <span className="w-4" />
                        Remove from horizon
                      </button>
                    </>
                  )}
                </div>

                {/* Lane picker - only shown when horizon is assigned */}
                {idea.horizon && (
                  <>
                    <p className="mb-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
                      Lane
                    </p>
                    <div className="mb-2">
                      {horizonLanes.length > 0 && (
                        <button
                          onClick={() => handleSetLane(null)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-600 hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.04]"
                        >
                          <span className="w-4">
                            {idea.focus_lane == null && (
                              <Check size={12} strokeWidth={2} className="text-indigo-500" />
                            )}
                          </span>
                          {unassignedLabel}
                        </button>
                      )}
                      {horizonLanes.map((lane) => (
                        <button
                          key={lane.id}
                          onClick={() => handleSetLane(lane.id)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-600 hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.04]"
                        >
                          <span className="w-4">
                            {idea.focus_lane === lane.id && (
                              <Check size={12} strokeWidth={2} className="text-indigo-500" />
                            )}
                          </span>
                          {lane.label}
                        </button>
                      ))}
                      {horizonLanes.length === 0 && (
                        <p className="px-2 py-1.5 text-xs text-gray-400 italic">
                          No lanes configured
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Reveal in Horizon */}
                {idea.horizon && (
                  <button
                    onClick={() => {
                      router.push(getRevealHref("horizon", idea, ideas));
                      onClose();
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10"
                  >
                    <Telescope size={12} strokeWidth={1.5} />
                    Reveal in Horizon
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notes Section */}
          <DetailsEditor value={idea.notes} onSave={handleSave} />
          <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
            ⌘+Enter to save · Esc to close
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

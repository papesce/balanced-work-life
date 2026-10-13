"use client";

import { ChevronsUpDown, Clock } from "lucide-react";
import { RangeWindowDropdown } from "@/components/timeline/RangeWindowDropdown";
import { formatTimelineDate } from "@/components/timeline/timelineUtils";
import { getDropdownCounts, type TimelinePresetId, type TimelineView } from "@/lib/timelinePresets";

interface TimelineToolbarProps {
  view: TimelineView;
  filter: "all" | "deferred";
  hasRevisitDates: boolean;
  preset: TimelinePresetId;
  rangeCounts: { past: Record<string, number>; future: Record<string, number> };
  rangeSpans: Record<string, string>;
  windowMenuOpen: boolean;
  onViewChange: (v: TimelineView) => void;
  onFilterChange: (id: "all" | "deferred") => void;
  onToggleWindowMenu: () => void;
  onCloseWindowMenu: () => void;
  onSelectPreset: (id: TimelinePresetId) => void;
}

export function TimelineToolbar({
  view,
  filter,
  hasRevisitDates,
  preset,
  rangeCounts,
  rangeSpans,
  windowMenuOpen,
  onViewChange,
  onFilterChange,
  onToggleWindowMenu,
  onCloseWindowMenu,
  onSelectPreset,
}: TimelineToolbarProps) {
  return (
    <>
      <div className="flex h-8 gap-1 rounded-lg border border-black/5 bg-white/70 p-0.5 shadow-sm dark:border-white/5 dark:bg-gray-900/60">
        {[
          { id: "agenda" as const, label: "Agenda" },
          { id: "week" as const, label: "Week" },
          { id: "month" as const, label: "Month" },
        ].map((tab) => {
          const isActive = view === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id)}
              title={`Switch to ${tab.label} view`}
              className={`cursor-pointer rounded-md px-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-white font-bold text-violet-600 shadow-sm dark:bg-gray-800 dark:text-violet-400"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="flex h-8 gap-1 rounded-lg border border-black/5 bg-white/70 p-0.5 shadow-sm dark:border-white/5 dark:bg-gray-900/60">
        {[
          { id: "all" as const, label: "All" },
          { id: "deferred" as const, label: "Deferred", icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = filter === tab.id;
          const isDisabled = tab.id === "deferred" && !hasRevisitDates;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isDisabled) return;
                onFilterChange(tab.id);
              }}
              disabled={isDisabled}
              title={isDisabled ? "Deferred applies to past dates" : undefined}
              className={`flex items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-all ${
                isDisabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
              } ${
                isActive
                  ? "bg-white font-bold text-violet-600 shadow-sm dark:bg-gray-800 dark:text-violet-400"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              {Icon && <Icon size={13} />}
              {tab.label}
            </button>
          );
        })}
      </div>
      {view === "agenda" && (
        <RangeWindowDropdown
          preset={preset}
          counts={getDropdownCounts(rangeCounts)}
          spans={rangeSpans}
          open={windowMenuOpen}
          onToggle={onToggleWindowMenu}
          onClose={onCloseWindowMenu}
          onSelect={onSelectPreset}
        />
      )}
    </>
  );
}

export function TimelineFloatingControls({
  anchor,
  anchorVisible,
  showTodayPill,
  onJumpToAnchor,
  onJumpToToday,
}: {
  anchor: string;
  anchorVisible: boolean;
  showTodayPill: boolean;
  onJumpToAnchor: () => void;
  onJumpToToday: () => void;
}) {
  return (
    <>
      {/* Floating button to navigate back to the selected date */}
      {!anchorVisible && (
        <button
          onClick={onJumpToAnchor}
          className="fixed right-6 bottom-6 z-50 flex items-center justify-center rounded-full bg-violet-600 p-3 text-white shadow-lg transition-all hover:scale-110 hover:bg-violet-700"
          aria-label={`Jump to ${formatTimelineDate(anchor)}`}
        >
          <ChevronsUpDown size={20} />
        </button>
      )}
      {/* Sticky Today pill when today is out of view */}
      {showTodayPill && (
        <button
          onClick={onJumpToToday}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-violet-700"
          aria-label="Jump to today"
        >
          Today
        </button>
      )}
    </>
  );
}

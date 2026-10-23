"use client";

import { useState } from "react";
import { Tag } from "lucide-react";
import { FilterMenu } from "@/components/shared/FilterMenu";
import { HorizonViewSwitcher, type DisplayLens } from "@/components/horizon/HorizonViewSwitcher";
import { TypeFilterPicker } from "@/components/shared/TypeFilterPicker";
import type { HorizonLensDef } from "@/lib/horizonLenses";
import type { HorizonView } from "@/lib/horizonViews";
import type { ClassificationScheme, IdeaType } from "@/lib/types";

interface HorizonBoardHeaderProps {
  views: HorizonView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  displayLenses: DisplayLens[];
  activeLensId: string | null;
  defaultLensId: string | null;
  schemes: ClassificationScheme[];
  onSelectView: (id: string) => void;
  onDeleteView: (id: string) => void;
  onToggleDefaultView: (id: string) => void;
  onSelectLens: (lens: HorizonLensDef) => void;
  onToggleDefaultLens: (id: string) => void;
  onCreateLens: () => void;
  onStartEdit: (id: string) => void;
  showClassificationOrder: boolean;
  onToggleShowClassificationOrder: () => void;
  hideClosed: boolean;
  onToggleHideClosed: () => void;
  hideUpcoming: boolean;
  onToggleHideUpcoming: () => void;
  hideOverdue: boolean;
  onToggleHideOverdue: () => void;
  hideProjectsWithTasks: boolean;
  onToggleHideProjectsWithTasks: () => void;
  typeFilter: IdeaType[];
  onToggleTypeFilter: (type: IdeaType) => void;
  onClearTypeFilter: () => void;
  cardMode: boolean;
  onToggleCardMode: () => void;
}

export function HorizonBoardHeader({
  views,
  activeViewId,
  defaultViewId,
  displayLenses,
  activeLensId,
  defaultLensId,
  schemes,
  onSelectView,
  onDeleteView,
  onToggleDefaultView,
  onSelectLens,
  onToggleDefaultLens,
  onCreateLens,
  onStartEdit,
  showClassificationOrder,
  onToggleShowClassificationOrder,
  hideClosed,
  onToggleHideClosed,
  hideUpcoming,
  onToggleHideUpcoming,
  hideOverdue,
  onToggleHideOverdue,
  hideProjectsWithTasks,
  onToggleHideProjectsWithTasks,
  typeFilter,
  onToggleTypeFilter,
  onClearTypeFilter,
  cardMode,
  onToggleCardMode,
}: HorizonBoardHeaderProps) {
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [typePickerPos, setTypePickerPos] = useState<{ top: number; left: number } | null>(null);

  return (
    <>
      <HorizonViewSwitcher
        views={views}
        activeViewId={activeViewId}
        defaultViewId={defaultViewId}
        lenses={displayLenses}
        activeLensId={activeLensId}
        defaultLensId={defaultLensId}
        schemes={schemes}
        onSelect={onSelectView}
        onDelete={onDeleteView}
        onToggleDefault={onToggleDefaultView}
        onSelectLens={onSelectLens}
        onToggleDefaultLens={onToggleDefaultLens}
        onCreateLens={onCreateLens}
        onStartEdit={onStartEdit}
        showClassificationOrder={showClassificationOrder}
        onToggleShowClassificationOrder={onToggleShowClassificationOrder}
      />
      <FilterMenu
        title="Display"
        options={[
          {
            key: "closed",
            label: "Hide closed",
            description: "Hide completed, cancelled, missed and archived items",
            checked: hideClosed,
            onToggle: onToggleHideClosed,
          },
          {
            key: "upcoming",
            label: "Hide upcoming",
            description: "Hide tasks dated today or later, plus in-progress work",
            checked: hideUpcoming,
            onToggle: onToggleHideUpcoming,
          },
          {
            key: "overdue",
            label: "Hide overdue",
            description: "Hide past-due tasks; off surfaces them for rescheduling",
            checked: hideOverdue,
            onToggle: onToggleHideOverdue,
          },
          {
            key: "projects",
            label: "Hide projects with visible tasks",
            description: "Tasks show on their own with the project breadcrumb",
            checked: hideProjectsWithTasks,
            onToggle: onToggleHideProjectsWithTasks,
          },
        ]}
      />
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTypePickerPos({ top: rect.bottom + 4, left: rect.left });
            setTypePickerOpen((v) => !v);
          }}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            typeFilter.length > 0
              ? "border-indigo-300 bg-white text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
              : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
          }`}
        >
          <Tag size={12} />
          <span className="hidden sm:inline">
            {typeFilter.length > 0
              ? `${typeFilter.length} type${typeFilter.length > 1 ? "s" : ""}`
              : "Type"}
          </span>
        </button>
        {typePickerOpen && typePickerPos && (
          <TypeFilterPicker
            selected={typeFilter}
            onToggle={onToggleTypeFilter}
            onClear={onClearTypeFilter}
            onClose={() => setTypePickerOpen(false)}
            position={typePickerPos}
          />
        )}
      </div>
      <button
        type="button"
        onClick={onToggleCardMode}
        className={`toolbar-btn ${cardMode ? "toolbar-btn--accent" : ""}`}
        title={cardMode ? "Show rows" : "Show cards"}
        aria-pressed={cardMode}
      >
        {cardMode ? "Rows" : "Cards"}
      </button>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Bookmark, Check, ChevronDown, Pencil, Plus, Star } from "lucide-react";
import { FloatingPanel } from "@/components/shared/FloatingPanel";
import type { ClassificationScheme } from "@/lib/types";
import { DEFAULT_LENSES, type HorizonLensDef } from "@/lib/horizonLenses";
import type { HorizonView } from "@/lib/horizonViews";

/** Built-in lens display info: seeded DB rows (user edits) override constants. */
export interface DisplayLens {
  id: string;
  name: string;
  description?: string;
  primaryScheme: string;
}

interface HorizonViewSwitcherProps {
  views: HorizonView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  /** Built-in lenses shown above saved views (display names may be user-edited). */
  lenses: DisplayLens[];
  activeLensId: string | null;
  defaultLensId: string | null;
  schemes: ClassificationScheme[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleDefault: (id: string) => void;
  onSelectLens: (lens: HorizonLensDef) => void;
  onToggleDefaultLens: (id: string) => void;
  onCreateLens: () => void;
  /** Editing happens in the below-header panel; this opens the session. */
  onStartEdit: (id: string) => void;
}

export function HorizonViewSwitcher({
  views,
  activeViewId,
  defaultViewId,
  lenses,
  activeLensId,
  defaultLensId,
  schemes,
  onSelect,
  onDelete,
  onToggleDefault,
  onSelectLens,
  onToggleDefaultLens,
  onCreateLens,
  onStartEdit,
}: HorizonViewSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const active = views.find((view) => view.id === activeViewId) ?? null;
  const activeLens = lenses.find((lens) => lens.id === activeLensId) ?? null;
  const orderedSchemes = useMemo(
    () => [...schemes].sort((a, b) => a.sort_order - b.sort_order),
    [schemes],
  );

  const userViews = useMemo(() => views.filter((v) => !v.is_builtin), [views]);

  const close = () => setOpen(false);

  return (
    <div>
      <button
        type="button"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchor({ top: rect.bottom + 4, left: rect.left });
          setOpen((value) => !value);
        }}
        className="flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 dark:border-violet-500/50 dark:bg-violet-900/20 dark:text-violet-300"
        title="Choose or manage Horizon lenses"
      >
        <Bookmark size={12} />
        <span className="max-w-[140px] truncate">
          {active?.name ?? activeLens?.name ?? "Choose lens"}
        </span>
        <ChevronDown size={12} className="opacity-60" />
      </button>
      {open && anchor && (
        <FloatingPanel
          anchor={anchor}
          onClose={close}
          className="w-[min(26rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-gray-900"
        >
          <div className="max-h-72 overflow-y-auto p-2">
            {lenses.map((lens) => (
              <div
                key={lens.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-2 ${lens.id === activeLensId && !active ? "bg-violet-50 dark:bg-violet-900/20" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    // Selection semantics stay id-based; the live lens
                    // definition always comes from the constants.
                    const def =
                      DEFAULT_LENSES.find((l) => l.id === lens.id) ??
                      DEFAULT_LENSES.find((l) => l.primaryScheme === lens.primaryScheme) ??
                      DEFAULT_LENSES[0];
                    onSelectLens(def);
                    setOpen(false);
                  }}
                  title={lens.description}
                  className="min-w-0 flex-1 text-left text-xs font-semibold text-gray-700 dark:text-gray-200"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{lens.name}</span>
                    {lens.id === activeLensId && !active && (
                      <Check size={12} className="text-violet-600" />
                    )}
                  </span>
                  {lens.description && (
                    <span className="mt-0.5 block truncate text-[10px] font-normal text-gray-400">
                      {lens.description}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStartEdit(lens.id);
                    setOpen(false);
                  }}
                  aria-label={`Edit ${lens.name}`}
                  title="Edit lens"
                  className="rounded p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-violet-600"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleDefaultLens(lens.id)}
                  aria-label={
                    defaultLensId === lens.id ? "Remove default lens" : "Set default lens"
                  }
                  title={defaultLensId === lens.id ? "Default lens" : "Set as default"}
                  className={`rounded p-1.5 ${defaultLensId === lens.id ? "text-amber-500" : "text-gray-400 opacity-0 group-hover:opacity-100"}`}
                >
                  <Star size={13} className={defaultLensId === lens.id ? "fill-amber-400" : ""} />
                </button>
              </div>
            ))}
            {userViews.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-500">
                No saved lenses yet. Create one to choose grouping and priority order.
              </p>
            )}
            {userViews.map((view) => (
              <div
                key={view.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-2 ${view.id === activeViewId ? "bg-violet-50 dark:bg-violet-900/20" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelect(view.id);
                    setOpen(false);
                  }}
                  className="min-w-0 flex-1 text-left text-xs font-semibold text-gray-700 dark:text-gray-200"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{view.name}</span>
                    {view.id === activeViewId && <Check size={12} className="text-violet-600" />}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] font-normal text-gray-400">
                    {orderedSchemes.find((scheme) => scheme.key === view.primary)?.label ??
                      view.primary}
                    {view.sortBy === "priority" ? " · lens order" : " · manual order"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStartEdit(view.id);
                    setOpen(false);
                  }}
                  aria-label={`Edit ${view.name}`}
                  title="Edit lens"
                  className="rounded p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-violet-600"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleDefault(view.id)}
                  aria-label={
                    defaultViewId === view.id ? "Remove default lens" : "Set default lens"
                  }
                  title={defaultViewId === view.id ? "Default lens" : "Set as default"}
                  className={`rounded p-1.5 ${defaultViewId === view.id ? "text-amber-500" : "text-gray-400 opacity-0 group-hover:opacity-100"}`}
                >
                  <Star size={13} className={defaultViewId === view.id ? "fill-amber-400" : ""} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(view.id)}
                  aria-label={`Delete ${view.name}`}
                  title="Delete lens"
                  className="rounded p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-black/5 p-2 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                onCreateLens();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"
            >
              <Plus size={14} />
              Create lens
            </button>
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Bookmark, Check, ChevronDown, Plus, Settings2, Star } from "lucide-react";
import { FloatingPanel } from "@/components/shared/FloatingPanel";
import type { ClassificationScheme } from "@/lib/types";
import { viewColumnKey, type HorizonView } from "@/lib/horizonViews";
import type { HorizonLensDef } from "@/lib/horizonLenses";

interface HorizonViewSwitcherProps {
  views: HorizonView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  /** Built-in lenses shown above saved views. */
  lenses: HorizonLensDef[];
  activeLensId: string | null;
  defaultLensId: string | null;
  schemes: ClassificationScheme[];
  columnKeys: (string | null)[];
  onSelect: (id: string) => void;
  onSave: (view: HorizonView) => void;
  onDelete: (id: string) => void;
  onToggleDefault: (id: string) => void;
  onSelectLens: (lens: HorizonLensDef) => void;
  onToggleDefaultLens: (id: string) => void;
}

const fieldClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800";

export function HorizonViewSwitcher({
  views,
  activeViewId,
  defaultViewId,
  lenses,
  activeLensId,
  defaultLensId,
  schemes,
  columnKeys,
  onSelect,
  onSave,
  onDelete,
  onToggleDefault,
  onSelectLens,
  onToggleDefaultLens,
}: HorizonViewSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [editing, setEditing] = useState<HorizonView | null>(null);
  const active = views.find((view) => view.id === activeViewId) ?? null;
  const activeLens = lenses.find((lens) => lens.id === activeLensId) ?? null;
  const orderedSchemes = useMemo(
    () => [...schemes].sort((a, b) => a.sort_order - b.sort_order),
    [schemes],
  );
  /** Group-by options: default lenses by lens name, then schemes without a
   *  default lens (synthesized, e.g. nnl/priority) by scheme label. */
  const groupByOptions = useMemo(() => {
    const lensed = new Set(lenses.map((lens) => lens.primaryScheme));
    return [
      ...lenses.map((lens) => ({ value: lens.primaryScheme, label: lens.name })),
      ...orderedSchemes
        .filter((scheme) => !lensed.has(scheme.key))
        .map((scheme) => ({ value: scheme.key, label: scheme.label })),
    ];
  }, [lenses, orderedSchemes]);

  const startNew = () => {
    const primary = active?.primary ?? orderedSchemes[0]?.key ?? "term";
    setEditing({
      id: crypto.randomUUID(),
      name: "",
      primary,
      splits: Object.fromEntries(columnKeys.map((key) => [viewColumnKey(key), null])),
      sortBy: "manual",
    });
  };

  const save = () => {
    if (!editing?.name.trim()) return;
    onSave({ ...editing, name: editing.name.trim(), sortBy: editing.sortBy ?? "manual" });
    setEditing(null);
    setOpen(false);
  };

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
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          className="w-[min(26rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-gray-900"
        >
          {editing ? (
            <div className="max-h-[min(80vh,42rem)] space-y-4 overflow-y-auto p-4">
              <div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                  {views.some((v) => v.id === editing.id) ? "Edit lens" : "Create a Horizon lens"}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Choose how Horizon groups and orders your work.
                </p>
              </div>
              <label className="block space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                Name
                <input
                  autoFocus
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  placeholder="e.g. Attention"
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                Group by
                <select
                  value={editing.primary}
                  onChange={(event) =>
                    setEditing({ ...editing, primary: event.target.value, splits: {} })
                  }
                  className={fieldClass}
                >
                  {groupByOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Split groups by
                </legend>
                {columnKeys.map((key) => {
                  const fieldKey = viewColumnKey(key);
                  const label =
                    key === null
                      ? "Unclassified"
                      : orderedSchemes.find((scheme) => scheme.key === editing.primary)?.label;
                  const value = editing.splits[fieldKey] ?? null;
                  return (
                    <label
                      key={fieldKey}
                      className="flex items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-300"
                    >
                      <span className="truncate">{label ?? fieldKey}</span>
                      <select
                        value={value ?? ""}
                        onChange={(event) =>
                          setEditing({
                            ...editing,
                            splits: { ...editing.splits, [fieldKey]: event.target.value || null },
                          })
                        }
                        className="max-w-40 rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800"
                      >
                        <option value="">No split</option>
                        {orderedSchemes
                          .filter((scheme) => scheme.key !== editing.primary)
                          .map((scheme) => (
                            <option key={scheme.key} value={scheme.key}>
                              {scheme.label}
                            </option>
                          ))}
                      </select>
                    </label>
                  );
                })}
              </fieldset>
              <label className="block space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                Order items within groups
                <select
                  value={editing.sortBy ?? "manual"}
                  onChange={(event) =>
                    setEditing({ ...editing, sortBy: event.target.value as "manual" | "priority" })
                  }
                  className={fieldClass}
                >
                  <option value="manual">Manual order</option>
                  <option value="priority">Lens order</option>
                </select>
              </label>
              <div className="flex justify-end gap-2 border-t border-black/5 pt-3 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-black/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!editing.name.trim()}
                  onClick={save}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Save lens
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-72 overflow-y-auto p-2">
                {lenses.map((lens) => (
                  <div
                    key={lens.id}
                    className={`group flex items-center gap-1 rounded-lg px-2 py-2 ${lens.id === activeLensId && !active ? "bg-violet-50 dark:bg-violet-900/20" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectLens(lens);
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
                      onClick={() => onToggleDefaultLens(lens.id)}
                      aria-label={
                        defaultLensId === lens.id ? "Remove default lens" : "Set default lens"
                      }
                      title={defaultLensId === lens.id ? "Default lens" : "Set as default"}
                      className={`rounded p-1.5 ${defaultLensId === lens.id ? "text-amber-500" : "text-gray-400 opacity-0 group-hover:opacity-100"}`}
                    >
                      <Star
                        size={13}
                        className={defaultLensId === lens.id ? "fill-amber-400" : ""}
                      />
                    </button>
                  </div>
                ))}
                {views.length === 0 && (
                  <p className="px-3 py-3 text-xs text-gray-500">
                    No saved lenses yet. Create one to choose grouping and priority order.
                  </p>
                )}
                {views.map((view) => (
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
                        {view.id === activeViewId && (
                          <Check size={12} className="text-violet-600" />
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] font-normal text-gray-400">
                        {orderedSchemes.find((scheme) => scheme.key === view.primary)?.label ??
                          view.primary}
                        {view.sortBy === "priority" ? " · lens order" : " · manual order"}
                      </span>
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
                      <Star
                        size={13}
                        className={defaultViewId === view.id ? "fill-amber-400" : ""}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing({ ...view, splits: { ...view.splits } })}
                      aria-label={`Edit ${view.name}`}
                      title="Edit lens"
                      className="rounded p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-violet-600"
                    >
                      <Settings2 size={13} />
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
                  onClick={startNew}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                >
                  <Plus size={14} />
                  Create lens
                </button>
              </div>
            </>
          )}
        </FloatingPanel>
      )}
    </div>
  );
}

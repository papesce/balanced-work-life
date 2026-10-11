"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  /** Read-only primary column order trail ("A → B → C"). */
  orderTrail?: string;
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
  /** When true, show the read-only primary order trail under each lens. */
  showClassificationOrder?: boolean;
  onToggleShowClassificationOrder?: () => void;
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
  showClassificationOrder = true,
  onToggleShowClassificationOrder,
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

  // Scroll affordance: the list (max-h-72, overflow-y-auto) hides saved
  // lenses below the fold. Track whether more content sits below the
  // viewport to paint a bottom fade hint, and bring the active row into
  // view when the menu opens.
  const listRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollHint = () => {
    const el = listRef.current;
    if (!el) return;
    setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  };

  useEffect(() => {
    if (!open) return;
    updateScrollHint();
    // With block:"nearest" this only scrolls when the active row is
    // actually out of view (e.g. a saved lens below the fold).
    activeRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const close = () => setOpen(false);

  // Pill shows the lens name only; the primary scheme is surfaced inside
  // the menu rows ("Primary: X") when the order toggle is on.
  const activeBaseName = active?.name ?? activeLens?.name ?? null;
  const pillLabel = activeBaseName ?? "Choose lens";

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
        title={pillLabel === "Choose lens" ? "Choose or manage Horizon lenses" : pillLabel}
      >
        <Bookmark size={12} />
        <span className="max-w-[220px] truncate">{pillLabel}</span>
        <ChevronDown size={12} className="opacity-60" />
      </button>
      {open && anchor && (
        <FloatingPanel
          anchor={anchor}
          onClose={close}
          className="relative w-[min(26rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-gray-900"
        >
          {onToggleShowClassificationOrder && (
            <button
              type="button"
              onClick={onToggleShowClassificationOrder}
              aria-pressed={showClassificationOrder}
              aria-label="Show classification order"
              title={
                showClassificationOrder
                  ? "Hide classification order (primary trails in menu, order line in header, secondary hints)"
                  : "Show classification order (primary trails in menu, order line in header, secondary hints)"
              }
              className="absolute top-2.5 right-3 z-20 flex items-center rounded-full p-1 text-gray-300 transition hover:text-violet-500 dark:text-gray-600 dark:hover:text-violet-400"
            >
              <span
                aria-hidden
                className={`flex h-[18px] w-7 items-center rounded-full px-0.5 transition-colors ${
                  showClassificationOrder
                    ? "justify-end bg-violet-500"
                    : "justify-start bg-gray-300 dark:bg-gray-700"
                }`}
              >
                <span className="h-3.5 w-3.5 rounded-full bg-white shadow" />
              </span>
            </button>
          )}
          <div className="relative">
            <div ref={listRef} onScroll={updateScrollHint} className="max-h-72 overflow-y-auto p-2">
              <p className="sticky top-0 z-10 bg-white px-3 pt-1 pb-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:bg-gray-900 dark:text-gray-500">
                Built-in lenses
              </p>
              {lenses.map((lens) => {
                const isActiveLens = lens.id === activeLensId && !active;
                return (
                  <div
                    key={lens.id}
                    ref={isActiveLens ? activeRowRef : undefined}
                    className={`group flex items-center gap-1 rounded-lg px-2 py-2 ${isActiveLens ? "bg-violet-50 dark:bg-violet-900/20" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"}`}
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
                      {showClassificationOrder && (
                        <span
                          className="mt-0.5 block truncate text-[10px] font-normal text-violet-400 dark:text-violet-500"
                          title={lens.orderTrail ? `Order: ${lens.orderTrail}` : undefined}
                        >
                          Primary:{" "}
                          {orderedSchemes.find((s) => s.key === lens.primaryScheme)?.label ??
                            lens.primaryScheme}
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
                      <Star
                        size={13}
                        className={defaultLensId === lens.id ? "fill-amber-400" : ""}
                      />
                    </button>
                  </div>
                );
              })}
              <p className="sticky top-0 z-10 bg-white px-3 pt-2 pb-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:bg-gray-900 dark:text-gray-500">
                My lenses{userViews.length > 0 ? ` (${userViews.length})` : ""}
              </p>
              {userViews.length === 0 && (
                <p className="px-3 py-3 text-xs text-gray-500">
                  No saved lenses yet. Create one to choose grouping and priority order.
                </p>
              )}
              {userViews.map((view) => (
                <div
                  key={view.id}
                  ref={view.id === activeViewId ? activeRowRef : undefined}
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
            {canScrollDown && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-2 bottom-0 flex h-10 items-end justify-center bg-gradient-to-t from-white via-white/80 to-transparent pb-1 dark:from-gray-900 dark:via-gray-900/80"
              >
                <span className="animate-bounce text-[10px] font-semibold text-violet-500">
                  more below ↓
                </span>
              </div>
            )}
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

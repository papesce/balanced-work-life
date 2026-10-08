"use client";

import { useState } from "react";
import { Check, Info } from "lucide-react";
import { CLASSIFICATION_HINTS } from "@/lib/classificationHelp";
import { FloatingPanel } from "@/components/shared/FloatingPanel";

interface ValueHelpInfoProps {
  /** Active lens key (e.g. "term", "nnl", "area"). */
  lensKey: string;
  /** Human label of the active lens (e.g. "Horizon", "NNL"). */
  schemeLabel: string;
  /** Lens columns; the null (Unclassified) entry is skipped unless onlyValue is null. */
  columns: { key: string | null; label: string }[];
  /** Currently selected value, if any. Shown with a check in full-list mode. */
  current: string | null;
  /**
   * Single-value mode (e.g. group headers): explain only this value.
   * Pass null to explain the Unclassified column instead.
   * Omit for the full per-value list.
   */
  onlyValue?: string | null;
}

/**
 * ⓘ helper explaining classification values. Full-list mode shows a
 * one-line explanation per value of the active lens; single-value mode
 * (`onlyValue`) explains just one column (e.g. a group header).
 * Renders nothing when we have no copy for the active lens.
 */
export function ValueHelpInfo({
  lensKey,
  schemeLabel,
  columns,
  current,
  onlyValue,
}: ValueHelpInfoProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const singleMode = onlyValue !== undefined;
  const entries = singleMode
    ? columns.filter((c) => c.key === onlyValue).slice(0, 1)
    : columns.filter((c) => c.key !== null && CLASSIFICATION_HINTS[lensKey]?.[c.key] != null);
  const singleHint =
    singleMode && onlyValue !== null ? (CLASSIFICATION_HINTS[lensKey]?.[onlyValue] ?? null) : null;
  const currentHint = current != null ? (CLASSIFICATION_HINTS[lensKey]?.[current] ?? null) : null;

  if (singleMode && onlyValue !== null && singleHint == null) return null;
  if (entries.length === 0 && !(singleMode && onlyValue === null)) return null;

  const singleLabel = singleMode ? (entries[0]?.label ?? "Unclassified") : null;
  const triggerTitle = singleMode
    ? (singleHint ?? `Projects without a ${schemeLabel} value land here for triage.`)
    : (currentHint ?? `What do the ${schemeLabel} values mean?}`);
  const triggerAria = singleMode
    ? `What does ${singleLabel} mean?`
    : `What do the ${schemeLabel} values mean?`;

  return (
    <span
      className="relative inline-flex items-center"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen((v) => !v);
        }}
        aria-label={triggerAria}
        aria-expanded={open}
        title={triggerTitle}
        className="rounded p-0.5 text-gray-400 transition hover:text-violet-600 dark:text-gray-500 dark:hover:text-violet-400"
      >
        <Info size={11} />
      </button>
      {open && pos && (
        <FloatingPanel
          anchor={pos}
          onClose={() => setOpen(false)}
          className="w-56 rounded-xl border border-black/10 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-gray-900"
        >
          <p className="px-1 pb-1 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
            {singleMode ? singleLabel : `${schemeLabel} values`}
          </p>
          {singleMode && onlyValue === null && (
            <span className="block px-1 py-1 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
              {`Projects without a ${schemeLabel} value land here for triage.`}
            </span>
          )}
          {entries.map((entry) => (
            <span key={entry.key} className="flex items-start gap-1.5 rounded px-1 py-1">
              <span className="w-3 shrink-0 pt-0.5">
                {current === entry.key && (
                  <Check size={11} strokeWidth={2.5} className="text-violet-600" />
                )}
              </span>
              <span>
                <span className="block text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                  {entry.label}
                </span>
                <span className="block text-[11px] leading-snug text-gray-400 dark:text-gray-500">
                  {CLASSIFICATION_HINTS[lensKey][entry.key as string]}
                </span>
              </span>
            </span>
          ))}
        </FloatingPanel>
      )}
    </span>
  );
}

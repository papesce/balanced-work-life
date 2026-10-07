"use client";

import type { ReactNode } from "react";

interface ColumnShellProps {
  label: string;
  count: number;
  /** Extra controls on the right side of the header (e.g. Split select). */
  headerActions?: ReactNode;
  /** Collapse chevron for the unclassified strip, rendered next to the label. */
  collapseControl?: ReactNode;
  /** Extra content right after the label (e.g. an explainer ⓘ for the column value). */
  labelSuffix?: ReactNode;
  /** Footer content (e.g. quick-add input). */
  footer?: ReactNode;
  children: ReactNode;
}

/** Shared lens-board column shell: glass card + header + count. */
export function ColumnShell({
  label,
  count,
  headerActions,
  collapseControl,
  labelSuffix,
  footer,
  children,
}: ColumnShellProps) {
  return (
    <div className="glass-card flex min-w-0 flex-1 flex-col rounded-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-3 dark:border-white/5">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{label}</span>
          {collapseControl}
          {labelSuffix}
        </span>
        <span className="flex items-center gap-2">
          {headerActions}
          <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-gray-400 dark:bg-white/[0.06] dark:text-gray-500">
            {count}
          </span>
        </span>
      </div>
      {children}
      {footer}
    </div>
  );
}

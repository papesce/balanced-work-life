"use client";

import type { ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import { ColumnShell, type LensColumn } from "@/components/lens";
import { HorizonTree, type HorizonTreeProps } from "@/components/horizon/HorizonTree";

interface HorizonColumnProps {
  col: LensColumn;
  count: number;
  unclassifiedExpanded: boolean;
  onToggleUnclassified: () => void;
  /** True while a lens edit session is active: primary boxes show Split selects. */
  editSessionActive: boolean;
  secondaryKey: string | null;
  /** Group-by candidates for the Split select (active lens excluded). */
  splitOptions: { key: string; label: string }[];
  onSplitChange: (colKey: string | null, value: string | null) => void;
  footer?: ReactNode;
  treeProps: HorizonTreeProps;
  /** Read-only split classification name (e.g. "Effort"), shown as "Split: Effort". */
  secondarySplitName?: string | null;
  /** Master toggle for classification-order hints. */
  showClassificationOrder?: boolean;
}

/** One Horizon board column: header shell (+ Split select while editing)
 *  around the HorizonTree body. The unclassified strip renders collapsed
 *  as a bare body without the shell. */
export function HorizonColumn({
  col,
  count,
  unclassifiedExpanded,
  onToggleUnclassified,
  editSessionActive,
  secondaryKey,
  splitOptions,
  onSplitChange,
  footer,
  treeProps,
  secondarySplitName,
  showClassificationOrder = true,
}: HorizonColumnProps) {
  const isCollapsedStrip = col.key === null && !unclassifiedExpanded;
  const body = (
    <div className="max-h-[calc(100vh-220px)] min-h-[120px] flex-1 overflow-y-auto">
      <HorizonTree {...treeProps} />
    </div>
  );
  // While an edit session is active, each primary box carries its
  // Split control in the top-right corner (unclassified is never split).
  const splitSelect =
    editSessionActive && col.key !== null ? (
      <select
        value={secondaryKey ?? ""}
        onChange={(event) => onSplitChange(col.key, event.target.value || null)}
        title="Split this group into sub-groups"
        aria-label={`Split ${col.label} by`}
        className="max-w-40 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <option value="">No split</option>
        {splitOptions.map((scheme) => (
          <option key={scheme.key} value={scheme.key}>
            {scheme.label}
          </option>
        ))}
      </select>
    ) : undefined;
  if (isCollapsedStrip) return body;
  const collapseControl =
    col.key === null ? (
      <button
        type="button"
        onClick={onToggleUnclassified}
        title="Collapse unclassified section"
        aria-label="Collapse unclassified section"
        className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        <ChevronUp size={14} />
      </button>
    ) : undefined;
  return (
    <ColumnShell
      label={col.label}
      count={count}
      collapseControl={collapseControl}
      headerActions={splitSelect}
      footer={footer}
      headerMeta={
        showClassificationOrder && secondarySplitName ? (
          <span
            className="text-[11px] font-normal whitespace-nowrap text-gray-400 dark:text-gray-500"
            title={`Split by ${secondarySplitName}`}
          >
            Split: {secondarySplitName}
          </span>
        ) : undefined
      }
    >
      {body}
    </ColumnShell>
  );
}

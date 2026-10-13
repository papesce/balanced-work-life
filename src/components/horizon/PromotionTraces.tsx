"use client";

import type { IdeaNode as IdeaNodeType } from "@/lib/types";

export interface PromotedRef {
  id: string;
  columnKey: string;
}

interface PromotionTracesProps {
  node: IdeaNodeType;
  promotedByParent?: Map<string, PromotedRef[]>;
  secondaryPromotedByParent?: Map<string, PromotedRef[]>;
  columnLabelByKey?: Map<string, string>;
  secondaryLabelByValue?: Map<string, string>;
  onJumpToChild: (childId: string, childColumnKey: string, stayInColumn?: boolean) => void;
}

/** "↳ N children in <label>" traces for promoted (re-homed) child subtrees. */
export function PromotionTraces({
  node,
  promotedByParent,
  secondaryPromotedByParent,
  columnLabelByKey,
  secondaryLabelByValue,
  onJumpToChild,
}: PromotionTracesProps) {
  const refs = promotedByParent?.get(node.id) ?? [];
  const secRefs = secondaryPromotedByParent?.get(node.id) ?? [];
  if (refs.length === 0 && secRefs.length === 0) return null;
  const byColumn = new Map<string, { ref: PromotedRef; secondary: boolean }[]>();
  for (const r of refs) {
    const list = byColumn.get(`p:${r.columnKey}`) ?? [];
    list.push({ ref: r, secondary: false });
    byColumn.set(`p:${r.columnKey}`, list);
  }
  for (const r of secRefs) {
    const list = byColumn.get(`s:${r.columnKey}`) ?? [];
    list.push({ ref: r, secondary: true });
    byColumn.set(`s:${r.columnKey}`, list);
  }
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-9 py-0.5">
      {[...byColumn.entries()].map(([key, list]) => {
        const { ref: first, secondary } = list[0];
        const label = secondary
          ? (secondaryLabelByValue?.get(first.columnKey) ?? first.columnKey)
          : (columnLabelByKey?.get(first.columnKey) ?? first.columnKey);
        const text =
          list.length === 1 ? `1 child in ${label}` : `${list.length} children in ${label}`;
        return (
          <button
            key={key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onJumpToChild(first.id, first.columnKey, secondary ? true : undefined);
            }}
            title={`Jump to ${label}`}
            className="cursor-pointer text-[11px] text-gray-400 italic hover:text-indigo-500 hover:underline dark:text-gray-500"
          >
            ↳ {text}
          </button>
        );
      })}
    </div>
  );
}

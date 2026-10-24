"use client";

import type { RefObject } from "react";
import type { TreeItem, TreeNode, TreeOptions } from "./types";

interface RowLabelProps<T extends TreeItem> {
  node: TreeNode<T>;
  label: string;
  options: TreeOptions<T>;
  isCardMode: boolean;
  notesText: string;
  isEditing: boolean;
  canRename: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  editText: string;
  onEditTextChange: (v: string) => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onConfirmEdit: () => void;
  clickToInsert: boolean;
  onLabelClick: (e: React.MouseEvent) => void;
  onInsertLabelClick: (e: React.MouseEvent) => void;
}

/** Edit input vs card vs row label rendering for one tree row. */
export function RowLabel<T extends TreeItem>({
  node,
  label,
  options,
  isCardMode,
  notesText,
  isEditing,
  canRename,
  inputRef,
  editText,
  onEditTextChange,
  onInputKeyDown,
  onConfirmEdit,
  clickToInsert,
  onLabelClick,
  onInsertLabelClick,
}: RowLabelProps<T>) {
  const handleClick = (e: React.MouseEvent) => {
    if (options.onNodeLabelClick?.(node)) {
      e.stopPropagation();
      return;
    }
    if (clickToInsert && !isEditing) onInsertLabelClick(e);
    else onLabelClick(e);
  };
  if (isEditing && canRename) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editText}
        onChange={(e) => onEditTextChange(e.target.value)}
        onKeyDown={onInputKeyDown}
        onBlur={onConfirmEdit}
        className="max-w-sm min-w-0 flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm outline-none focus:border-indigo-500"
        placeholder={options.editPlaceholder ?? "Type an item..."}
      />
    );
  }
  if (isCardMode) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          onClick={handleClick}
          className={`cursor-text rounded px-1 py-0.5 text-sm leading-snug font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${
            options.labelClassName?.(node) ?? ""
          }`}
        >
          {label || <span className="text-gray-400 italic">{options.emptyLabel ?? ""}</span>}
        </span>
        {notesText && (
          <span className="line-clamp-2 px-1 text-xs leading-relaxed whitespace-pre-wrap text-gray-500 italic dark:text-gray-400">
            {notesText}
          </span>
        )}
        {options.renderCardBody?.(node)}
        <div className="flex flex-wrap items-center gap-1 px-1">
          {options.renderTrailing?.(node)}
        </div>
      </div>
    );
  }
  return (
    <span
      onClick={handleClick}
      className={`max-w-sm min-w-0 flex-1 cursor-text truncate rounded px-2 py-0.5 text-sm hover:bg-gray-100 dark:hover:bg-white/[0.04] ${
        options.labelClassName?.(node) ?? ""
      }`}
    >
      {label || <span className="text-gray-400 italic">{options.emptyLabel ?? ""}</span>}
    </span>
  );
}

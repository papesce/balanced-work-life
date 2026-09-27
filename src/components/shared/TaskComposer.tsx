"use client";

import { KeyboardEvent, useRef, useState } from "react";
import type { ReactNode } from "react";

export type TaskComposerVariant = "tree" | "plain" | "underline";

interface TaskComposerProps {
  placeholder: string;
  onCreate: (text: string) => Promise<void> | void;
  onDismiss?: () => void;
  /** Content rendered before the input (e.g. type picker pill). */
  leading?: ReactNode;
  /** Content rendered after the input (e.g. area dots). */
  trailing?: ReactNode;
  autoFocus?: boolean;
  variant?: TaskComposerVariant;
  /** Override the input className for a variant. */
  inputClassName?: string;
  /** Override the wrapper className for a variant. */
  className?: string;
  /** Show the "+" glyph (tree / plain affordance). Defaults per variant. */
  showPlus?: boolean;
  /** Indentation support for tree usage. */
  depth?: number;
  indentSize?: number;
}

const VARIANT_STYLES: Record<TaskComposerVariant, { wrap: string; input: string }> = {
  tree: {
    wrap: "flex items-center gap-1 rounded-md bg-indigo-50/40 px-1 py-1 dark:bg-indigo-500/10",
    input:
      "min-w-0 flex-1 rounded border border-dashed border-indigo-200 bg-white px-2 py-0.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-solid focus:border-indigo-500 dark:border-indigo-500/30 dark:bg-transparent dark:text-gray-200 dark:placeholder:text-gray-500",
  },
  plain: {
    wrap: "flex items-center gap-1.5",
    input:
      "min-w-0 flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200 dark:placeholder:text-gray-500",
  },
  underline: {
    wrap: "flex items-center gap-2",
    input:
      "min-w-0 flex-1 border-none bg-transparent py-1.5 text-sm italic outline-none placeholder:text-gray-300 focus:ring-0 dark:placeholder:text-gray-600",
  },
};

/**
 * Universal single-line task composer.
 * Unified contract: trim-guard, Enter=submit+clear, Escape=clear/dismiss,
 * double-submit guard. Context (area/type/date/time) is supplied by the
 * caller via `leading`/`trailing` slots or the `onCreate` closure — never
 * parsed from text. (Multi-line QuickNote capture stays separate.)
 */
export function TaskComposer({
  placeholder,
  onCreate,
  onDismiss,
  leading,
  trailing,
  autoFocus = false,
  variant = "plain",
  inputClassName,
  className,
  showPlus,
  depth = 0,
  indentSize = 20,
}: TaskComposerProps) {
  const [text, setText] = useState("");
  const submittingRef = useRef(false);
  const styles = VARIANT_STYLES[variant];
  const plus = showPlus ?? variant === "tree";

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submittingRef.current) return;
    submittingRef.current = true;
    try {
      setText("");
      await onCreate(trimmed);
    } finally {
      submittingRef.current = false;
    }
  };

  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (text) {
        setText("");
      } else {
        onDismiss?.();
      }
    }
  };

  const inner = (
    <div className={className ?? styles.wrap} onClick={(e) => e.stopPropagation()}>
      {variant === "tree" && <span className="h-5 w-5 flex-shrink-0" />}
      {leading}
      {plus && (
        <span className="w-[14px] flex-shrink-0 text-sm text-gray-300 select-none dark:text-gray-500">
          +
        </span>
      )}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={inputClassName ?? styles.input}
      />
      {trailing}
    </div>
  );

  if (variant === "underline") {
    return (
      <div className="task-input-wrapper">
        {inner}
        <div className="input-underline" />
      </div>
    );
  }

  if (depth > 0) {
    return <div style={{ paddingLeft: depth * indentSize }}>{inner}</div>;
  }
  return inner;
}

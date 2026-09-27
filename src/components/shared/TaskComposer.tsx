"use client";

import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { searchIdeas } from "@/lib/ideaSearch";
import { formatScheduleLabel, getTypeLabel } from "@/lib/ideaSearch";
import type { Idea } from "@/lib/types";

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
  /**
   * Opt-in duplicate warning: when provided, typing (min 2 chars, debounced)
   * shows matching OPEN ideas below the input. Enter still creates;
   * picking a match calls `onPickExisting` (default: discard the draft).
   */
  suggestFrom?: Idea[];
  suggestLimit?: number;
  onPickExisting?: (idea: Idea) => void;
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
  suggestFrom,
  suggestLimit = 5,
  onPickExisting,
}: TaskComposerProps) {
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  // Query for which the user explicitly closed the list (Escape / outside
  // click). Derived open state avoids set-state-in-effect.
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const submittingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const styles = VARIANT_STYLES[variant];
  const plus = showPlus ?? variant === "tree";

  // Debounce the query so each keystroke doesn't rescan the idea list.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 150);
    return () => clearTimeout(t);
  }, [text]);

  const suggestions = useMemo(
    () =>
      suggestFrom && debounced.trim().length >= 2
        ? searchIdeas(suggestFrom, debounced, { includeDone: false, limit: suggestLimit })
        : [],
    [suggestFrom, debounced, suggestLimit],
  );
  const listOpen = suggestions.length > 0 && dismissedQuery !== debounced;
  const active = Math.min(activeIndex, Math.max(suggestions.length - 1, 0));

  // Close the suggestion list on outside click.
  useEffect(() => {
    if (!listOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDismissedQuery(debounced);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [listOpen, debounced]);

  const normalizedQuery = debounced.trim().toLowerCase();
  const hasExactMatch = suggestions.some(
    (s) => (s.text ?? "").trim().toLowerCase() === normalizedQuery,
  );

  const pick = (idea: Idea) => {
    setText("");
    setDebounced("");
    onPickExisting?.(idea);
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submittingRef.current) return;
    submittingRef.current = true;
    try {
      setText("");
      setDebounced("");
      await onCreate(trimmed);
    } finally {
      submittingRef.current = false;
    }
  };

  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && listOpen && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
      return;
    }
    if (e.key === "ArrowUp" && listOpen && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
      return;
    }
    // Tab jumps to the highlighted existing task instead of creating.
    if (e.key === "Tab" && listOpen && suggestions.length > 0) {
      e.preventDefault();
      pick(suggestions[active] ?? suggestions[0]);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      await submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (listOpen) {
        setDismissedQuery(debounced);
      } else if (text) {
        setText("");
      } else {
        onDismiss?.();
      }
    }
  };

  const inner = (
    <div ref={containerRef} className="relative min-w-0 flex-1">
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
          onChange={(e) => {
            setText(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={inputClassName ?? styles.input}
          aria-expanded={listOpen}
          aria-autocomplete="list"
          aria-controls={listId}
          role="combobox"
        />
        {trailing}
      </div>
      {listOpen && suggestions.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label="Possible duplicates"
          className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border border-amber-200/70 bg-white shadow-lg dark:border-amber-500/20 dark:bg-gray-900"
        >
          <p
            className={`px-3 pt-2 text-[10px] font-semibold tracking-wide uppercase ${
              hasExactMatch
                ? "text-amber-600 dark:text-amber-400"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            {hasExactMatch ? "Already exists — Tab to open" : "Similar open tasks — Tab to open"}
          </p>
          <ul className="max-h-48 overflow-y-auto py-1">
            {suggestions.map((s, i) => {
              const schedule = formatScheduleLabel(s);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs ${
                      i === active
                        ? "bg-amber-50 dark:bg-amber-500/10"
                        : "bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                      {s.text || "Untitled"}
                    </span>
                    <span className="flex-shrink-0 rounded-full bg-black/[0.05] px-1.5 py-px text-[10px] font-medium text-gray-500 dark:bg-white/[0.08] dark:text-gray-400">
                      {getTypeLabel(s.type)}
                    </span>
                    {schedule && (
                      <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
                        {schedule}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
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

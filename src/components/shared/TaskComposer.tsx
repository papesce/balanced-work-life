"use client";

import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { searchIdeas } from "@/lib/ideaSearch";
import { formatScheduleLabel, getTypeLabel } from "@/lib/ideaSearch";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/constants";
import { canRevealInView, getRevealHref, getSmartRevealView, type RevealView } from "@/lib/reveal";
import type { Idea } from "@/lib/types";

function pathnameToView(pathname: string): RevealView | null {
  if (pathname === "/") return "planner";
  if (pathname === "/timeline") return "timeline";
  if (pathname === "/horizon") return "horizon";
  if (pathname === "/brainstorm") return "brainstorm";
  if (pathname === "/projects") return "projects";
  if (pathname === "/goals") return "goals";
  return null;
}

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
   * picking a match (click / Tab) calls `onPickExisting` when provided,
   * otherwise navigates to the existing task (current view when it can
   * reveal it, else the smart reveal view) via `?highlight=`.
   */
  suggestFrom?: Idea[];
  suggestLimit?: number;
  onPickExisting?: (idea: Idea) => void;
  /** Override auto-detected current view (from pathname) for reveal routing. */
  currentView?: RevealView | null;
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
  currentView: currentViewProp,
}: TaskComposerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = currentViewProp !== undefined ? currentViewProp : pathnameToView(pathname);
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  // Query for which the user explicitly closed the list (Escape / outside
  // click). Derived open state avoids set-state-in-effect.
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const submittingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Fixed position of the portalled dropdown, measured from the input row.
  const [listPos, setListPos] = useState<{ top: number; left: number; width: number } | null>(null);
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

  // Close the suggestion list on outside click (the portalled list counts
  // as inside — its buttons dismiss via mousedown-prevention + click).
  useEffect(() => {
    if (!listOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setDismissedQuery(debounced);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [listOpen, debounced]);

  // Measure the input row so the portalled dropdown can anchor to it.
  // Re-measure on scroll/resize/suggestion change: the page scrolls under a
  // fixed-position list. State updates happen in async callbacks only.
  useEffect(() => {
    if (!listOpen) return;
    const measure = () => {
      const rect = rowRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(rect.width, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const estHeight = 220;
      const top =
        rect.bottom + estHeight > window.innerHeight && rect.top - estHeight - 4 > 0
          ? rect.top - estHeight - 4
          : rect.bottom + 4;
      setListPos({ top, left, width });
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [listOpen, suggestions]);

  const normalizedQuery = debounced.trim().toLowerCase();
  const hasExactMatch = suggestions.some(
    (s) => (s.text ?? "").trim().toLowerCase() === normalizedQuery,
  );

  const pick = (idea: Idea) => {
    setText("");
    setDebounced("");
    if (onPickExisting) {
      onPickExisting(idea);
      return;
    }
    // Default: navigate to the existing task so users don't create dupes.
    // Prefer staying in the current view when it can render the idea;
    // otherwise fall back to the smart reveal view. Horizon keeps the
    // active lens params (the page auto-switches to the idea's column).
    const allIdeas = suggestFrom;
    let href: string;
    if (currentView && canRevealInView(currentView, idea, allIdeas)) {
      if (currentView === "horizon") {
        const lens = searchParams.get("lens") ?? "term";
        const horizon = searchParams.get("horizon");
        href = horizon
          ? getRevealHref(currentView, idea, allIdeas, horizon, lens)
          : getRevealHref(currentView, idea, allIdeas);
        // Preserve a non-default lens when the default href would reset it.
        if (!horizon && lens !== "term") {
          href = getRevealHref(currentView, idea, allIdeas, undefined, lens);
        }
      } else {
        href = getRevealHref(currentView, idea, allIdeas);
      }
    } else {
      href = getRevealHref(getSmartRevealView(idea, allIdeas), idea, allIdeas);
    }
    onDismiss?.();
    router.push(href);
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
    <div ref={containerRef} className="min-w-0 flex-1">
      <div ref={rowRef} className={className ?? styles.wrap} onClick={(e) => e.stopPropagation()}>
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
      {listOpen &&
        suggestions.length > 0 &&
        listPos &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Possible duplicates"
            style={{
              position: "fixed",
              top: listPos.top,
              left: listPos.left,
              width: listPos.width,
              zIndex: 10000,
            }}
            className="overflow-hidden rounded-xl border border-amber-200/70 bg-white shadow-lg dark:border-amber-500/20 dark:bg-gray-900"
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
                      <span
                        className={`flex-shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium ${STATUS_STYLES[s.status]}`}
                      >
                        {STATUS_LABELS[s.status]}
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
          </div>,
          document.body,
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

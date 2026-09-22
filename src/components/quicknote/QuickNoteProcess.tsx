"use client";

import { useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@powersync/react";
import { useAuth } from "@/hooks/useAuth";
import { useQuickNoteContext } from "@/contexts/QuickNoteContext";
import { parseNoteLines, findBestMatch, type MatchResult } from "@/lib/quickNotes";
import { Idea } from "@/lib/types";
import { getRevealHref, type RevealView } from "@/lib/reveal";
import { QuickNoteLineRow } from "./QuickNoteLineRow";

/**
 * Process mode: renders one row per non-blank, unresolved line.
 * Pre-computes match suggestions for each line using all user ideas.
 * Resolved lines are shown dimmed at the bottom.
 * Line text is read-only; only actions (match, create, discard) are available.
 */
export function QuickNoteProcess() {
  const { draft } = useQuickNoteContext();
  const { user } = useAuth();

  const lines = useMemo(() => parseNoteLines(draft), [draft]);
  const unresolved = lines.filter((l) => !l.resolved);
  const resolved = lines.filter((l) => l.resolved);

  const { data: ideaRows } = useQuery<Record<string, unknown>>(
    user
      ? "SELECT * FROM ideas WHERE user_id = ? ORDER BY sort_order ASC"
      : "SELECT * FROM ideas WHERE 0",
    user ? [user.id] : [],
  );
  const ideas: Idea[] = useMemo(() => (ideaRows as unknown as Idea[]) ?? [], [ideaRows]);

  const matchMap = useMemo(() => {
    const map = new Map<number, MatchResult>();
    for (const line of unresolved) {
      const result = findBestMatch(line.text, ideas);
      if (result) {
        map.set(line.index, result);
      }
    }
    return map;
  }, [unresolved, ideas]);

  // Track which line index should auto-focus. null = none focused.
  const [focusedIndex, setFocusedIndex] = useState<number | null>(() =>
    unresolved.length > 0 ? unresolved[0].index : null,
  );

  const handleLineResolved = useCallback(() => {
    requestAnimationFrame(() => {
      const nextLines = parseNoteLines(draft);
      const nextUnresolved = nextLines.filter((l) => !l.resolved);
      if (nextUnresolved.length > 0) {
        setFocusedIndex(nextUnresolved[0].index);
      } else {
        setFocusedIndex(null);
      }
    });
  }, [draft]);

  const unresolvedCount = unresolved.length;
  const totalLines = unresolved.length + resolved.length;

  return (
    <div className="flex flex-col gap-1 p-4">
      {unresolvedCount > 0 && totalLines > 1 && (
        <div className="mb-2 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-300"
              style={{ width: `${((totalLines - unresolvedCount) / totalLines) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
            {totalLines - unresolvedCount}/{totalLines}
          </span>
        </div>
      )}

      {unresolved.length === 0 && resolved.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          No lines to process.
        </p>
      )}

      {unresolved.map((line) => (
        <QuickNoteLineRow
          key={line.index}
          line={line}
          suggestedMatch={matchMap.get(line.index) ?? null}
          allIdeas={ideas}
          autoFocus={focusedIndex === line.index}
          onResolved={handleLineResolved}
          readonly
        />
      ))}

      {resolved.length > 0 && (
        <div className="mt-2 border-t border-black/5 pt-2 dark:border-white/5">
          <p className="mb-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
            Resolved
          </p>
          {resolved.map((line) => (
            <div
              key={line.index}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-400 line-through dark:text-gray-500"
            >
              <span className="text-green-500">✓</span>
              <span className="truncate">{line.text}</span>
              {line.matchedIdeaId && <MatchedIdeaChip ideaId={line.matchedIdeaId} ideas={ideas} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchedIdeaChip({ ideaId, ideas }: { ideaId: string; ideas: Idea[] }) {
  const router = useRouter();
  const { closePanel } = useQuickNoteContext();
  const idea = ideas.find((i) => i.id === ideaId);

  const handleGoToTask = useCallback(() => {
    if (!idea) return;
    let view: RevealView = "brainstorm";
    if (idea.scheduled_date) {
      view = "planner";
    } else if (idea.type === "project") {
      view = "projects";
    } else if (idea.type === "objective") {
      view = "goals";
    }
    const href = getRevealHref(view, idea, ideas);
    closePanel();
    router.push(href);
  }, [idea, ideas, router, closePanel]);

  if (!idea) return null;

  return (
    <button
      onClick={handleGoToTask}
      className="flex-shrink-0 cursor-pointer rounded border border-violet-200 bg-violet-50 px-1.5 py-px text-[10px] text-violet-600 transition-colors hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300 dark:hover:bg-violet-500/25"
    >
      → {idea.text}
    </button>
  );
}

"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@powersync/react";
import {
  Eye,
  LayoutDashboard,
  CalendarDays,
  Telescope,
  BrainCircuit,
  FolderKanban,
  Target,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuickNoteEditor, useQuickNoteData } from "@/contexts/QuickNoteContext";
import { IdeaSearchPicker } from "@/components/brainstorm/IdeaSearchPicker";
import type { Idea } from "@/lib/types";
import {
  getRevealHref,
  canRevealInView,
  getRevealLabel,
  getSmartRevealView,
  type RevealView,
} from "@/lib/reveal";

const VIEWS: RevealView[] = ["planner", "timeline", "horizon", "brainstorm", "projects", "goals"];

const VIEW_ICON: Record<RevealView, React.ReactNode> = {
  planner: <LayoutDashboard size={12} />,
  timeline: <CalendarDays size={12} />,
  horizon: <Telescope size={12} />,
  brainstorm: <BrainCircuit size={12} />,
  projects: <FolderKanban size={12} />,
  goals: <Target size={12} />,
};

/**
 * Inline idea search for Quick Notes. The dialog stays open while searching;
 * only picking a reveal target closes the panel and navigates.
 */
export function QuickNoteIdeaSearch({
  initialQuery,
  onDone,
  onOpenInGlobalSearch,
}: {
  initialQuery: string;
  /** Clear selection/search UI state (does not close the panel). */
  onDone: () => void;
  /** Fall back to the header global search (closes the panel). */
  onOpenInGlobalSearch: (query: string) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { closePanel } = useQuickNoteData();
  const { flushNow } = useQuickNoteEditor();
  const [eyeFor, setEyeFor] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [activeIdea, setActiveIdea] = useState<Idea | null>(null);
  const eyeRef = useRef<HTMLDivElement>(null);

  const { data: ideaRows } = useQuery<Record<string, unknown>>(
    user
      ? "SELECT * FROM ideas WHERE user_id = ? ORDER BY sort_order ASC"
      : "SELECT * FROM ideas WHERE 0",
    user ? [user.id] : [],
  );
  const allIdeas: Idea[] = useMemo(() => (ideaRows as unknown as Idea[]) ?? [], [ideaRows]);

  useEffect(() => {
    if (!eyeFor) return;
    const handler = (e: MouseEvent) => {
      if (eyeRef.current && !eyeRef.current.contains(e.target as Node)) setEyeFor(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [eyeFor]);

  const handleReveal = useCallback(
    async (idea: Idea, view: RevealView) => {
      setEyeFor(null);
      await flushNow();
      onDone();
      await closePanel();
      router.push(getRevealHref(view, idea, allIdeas));
    },
    [allIdeas, closePanel, flushNow, onDone, router],
  );

  const handlePick = useCallback(
    (idea: Idea) => {
      void handleReveal(idea, getSmartRevealView(idea, allIdeas));
    },
    [allIdeas, handleReveal],
  );

  const activeSmart = activeIdea ? getSmartRevealView(activeIdea, allIdeas) : null;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-black/10 bg-white/80 p-2 dark:border-white/10 dark:bg-gray-800/80">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
          Search ideas{activeSmart ? ` · Enter opens in ${getRevealLabel(activeSmart)}` : ""}
        </p>
        <button
          onClick={() => onOpenInGlobalSearch(query)}
          title="Close panel and search in the header bar"
          className="cursor-pointer text-[10px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Open in global search
        </button>
      </div>
      <IdeaSearchPicker
        ideas={allIdeas}
        initialQuery={initialQuery}
        matchAllWords
        placeholder="Search tasks, projects, goals..."
        emptyLabel="No matching ideas — it may not exist yet"
        onSearchChange={setQuery}
        onPick={handlePick}
        onActiveChange={setActiveIdea}
        renderActions={(idea) => {
          const targets = VIEWS.filter((v) => canRevealInView(v, idea, allIdeas));
          return (
            <div className="relative" ref={eyeFor === idea.id ? eyeRef : undefined}>
              <button
                onClick={() => setEyeFor((cur) => (cur === idea.id ? null : idea.id))}
                title="Reveal in…"
                aria-label={`Reveal "${idea.text || "untitled"}" in…`}
                className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
              >
                <Eye size={11} />
                Reveal in…
              </button>
              {eyeFor === idea.id && (
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-gray-800">
                  {targets.length === 0 && (
                    <p className="px-3 py-2 text-xs text-gray-400 italic">No view can show this</p>
                  )}
                  {targets.map((view) => (
                    <button
                      key={view}
                      onClick={() => void handleReveal(idea, view)}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                    >
                      {VIEW_ICON[view]}
                      {getRevealLabel(view)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}

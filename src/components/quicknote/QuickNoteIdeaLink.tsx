"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BrainCircuit,
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  Target,
  Telescope,
} from "lucide-react";
import type { Idea } from "@/lib/types";
import { canRevealInView, getRevealLabel, type RevealView } from "@/lib/reveal";
import type { NoteIdeaSegment } from "@/lib/quicknote/markdownLinks";

const VIEWS: RevealView[] = ["planner", "timeline", "horizon", "brainstorm", "projects", "goals"];

const VIEW_ICON: Record<RevealView, React.ReactNode> = {
  planner: <LayoutDashboard size={12} />,
  timeline: <CalendarDays size={12} />,
  horizon: <Telescope size={12} />,
  brainstorm: <BrainCircuit size={12} />,
  projects: <FolderKanban size={12} />,
  goals: <Target size={12} />,
};

export function QuickNoteIdeaLink({
  segment,
  ideas,
  onReveal,
}: {
  segment: NoteIdeaSegment;
  ideas: Idea[];
  onReveal: (idea: Idea, view: RevealView) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const idea = ideas.find((candidate) => candidate.id === segment.ideaId);
  const views = useMemo(
    () => (idea ? VIEWS.filter((view) => canRevealInView(view, idea, ideas)) : []),
    [idea, ideas],
  );

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  if (!idea) {
    return <span className="text-gray-500 dark:text-gray-400">{segment.label}</span>;
  }

  return (
    <span
      ref={rootRef}
      className="relative inline-block"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        title={`Reveal "${idea.text || segment.label}" in…`}
        onClick={() => setOpen((current) => !current)}
        className="cursor-pointer rounded-sm text-violet-600 underline decoration-violet-300 underline-offset-2 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-violet-400 dark:decoration-violet-700 dark:hover:text-violet-300"
      >
        {segment.label}
      </button>
      {open && (
        <div
          role="group"
          aria-label={`Reveal ${idea.text || segment.label} in`}
          className="absolute top-full left-0 z-30 mt-1 min-w-44 rounded-xl border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-gray-800"
        >
          <p className="px-3 py-1 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
            Reveal in…
          </p>
          {views.map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => {
                setOpen(false);
                onReveal(idea, view);
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.03] focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              {VIEW_ICON[view]}
              {getRevealLabel(view)}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

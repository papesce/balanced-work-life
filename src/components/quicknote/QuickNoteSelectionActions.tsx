"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@powersync/react";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus,
  GitBranch,
  Check,
  MoreHorizontal,
  Eye,
  LayoutDashboard,
  CalendarDays,
  Telescope,
  BrainCircuit,
  FolderKanban,
  Target,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";
import { useQuickNoteEditor, useQuickNoteData } from "@/contexts/QuickNoteContext";
import { parseTaskAll, findBestMatch } from "@/lib/quickNotes";
import { Idea, IdeaType } from "@/lib/types";
import { getRevealHref, getSmartRevealView, getRevealLabel, type RevealView } from "@/lib/reveal";
import { IdeaSearchPicker } from "@/components/brainstorm/IdeaSearchPicker";

const KIND_PILL_STYLES: Record<IdeaType, string> = {
  idea: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  objective: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  project: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  initiative: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  task: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
};

export function KindPill({ kind }: { kind: IdeaType }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-px text-[10px] font-bold ${KIND_PILL_STYLES[kind]}`}
    >
      {kind === "objective" ? "goal" : kind}
    </span>
  );
}

type PickerMode = null | "create_under";

/**
 * Actions for an arbitrary text selection from the capture textarea.
 * Creates ideas from the selection without touching note text — no line
 * resolution, no archiving. "Match" is navigate-only.
 */
export function QuickNoteSelectionActions({
  selection,
  onMarked,
  onDone,
}: {
  selection: string;
  /** Insert the ✓ mark at the selection start (no-op for archived notes). */
  onMarked: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { createSelectionIdea, closePanel } = useQuickNoteData();
  const { flushNow } = useQuickNoteEditor();
  const [saving, setSaving] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [revealSubmenuOpen, setRevealSubmenuOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  const { data: ideaRows } = useQuery<Record<string, unknown>>(
    user
      ? "SELECT * FROM ideas WHERE user_id = ? ORDER BY sort_order ASC"
      : "SELECT * FROM ideas WHERE 0",
    user ? [user.id] : [],
  );
  const allIdeas: Idea[] = useMemo(() => (ideaRows as unknown as Idea[]) ?? [], [ideaRows]);

  const firstLine = useMemo(
    () =>
      selection
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)[0] ?? "",
    [selection],
  );
  const parsed = useMemo(() => parseTaskAll(firstLine), [firstLine]);
  const suggestedMatch = useMemo(
    () => (parsed.title ? findBestMatch(parsed.title, allIdeas) : null),
    [parsed.title, allIdeas],
  );
  const hasMatch = !!suggestedMatch && suggestedMatch.score >= 0.6;
  const smartView = hasMatch ? getSmartRevealView(suggestedMatch!.idea, allIdeas) : null;
  // Selections starting with the processed mark can't be created again.
  const hasMarked = selection.trimStart().startsWith("✓");

  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
        setRevealSubmenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [overflowOpen]);

  const handleCreate = useCallback(
    async (parentId?: string) => {
      setSaving(true);
      try {
        const id = await createSelectionIdea(selection, parentId ?? null);
        if (id) onMarked();
        onDone();
      } finally {
        setSaving(false);
      }
    },
    [createSelectionIdea, selection, onMarked, onDone],
  );

  const handleNavigate = useCallback(
    async (ideaId: string, view?: RevealView) => {
      const idea = allIdeas.find((i) => i.id === ideaId);
      if (!idea) return;
      const target = view ?? getSmartRevealView(idea, allIdeas);
      onMarked();
      // Persist the mark before leaving: the debounced autosave may not
      // have landed yet when the route changes.
      await flushNow();
      onDone();
      closePanel();
      router.push(getRevealHref(target, idea, allIdeas));
    },
    [allIdeas, closePanel, flushNow, onMarked, onDone, router],
  );

  const preview = selection.length > 120 ? selection.slice(0, 120).trimEnd() + "…" : selection;

  if (pickerMode === "create_under") {
    return (
      <div className="flex flex-col gap-1.5 rounded-xl border border-black/10 bg-white/80 p-2 dark:border-white/10 dark:bg-gray-800/80">
        <p className="px-1 text-[10px] font-bold text-gray-500 dark:text-gray-400">Create under…</p>
        <IdeaSearchPicker
          ideas={allIdeas}
          initialQuery={undefined}
          matchAllWords
          placeholder="Search for a parent idea..."
          renderActions={(idea, clearSearch) => (
            <button
              onClick={() => {
                clearSearch();
                void handleCreate(idea.id);
              }}
              className="flex cursor-pointer items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-600 hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-400"
            >
              <Check size={10} />
              Select
            </button>
          )}
        />
        <button
          onClick={() => setPickerMode(null)}
          className="self-start px-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-violet-200 bg-violet-50/50 p-2 dark:border-violet-500/30 dark:bg-violet-500/10">
      <div className="flex flex-wrap items-center gap-1.5 px-1">
        <p className="min-w-0 flex-1 truncate text-[11px] text-gray-500 dark:text-gray-400">
          “{preview}”
        </p>
        {parsed.kind && <KindPill kind={parsed.kind} />}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {hasMatch ? (
          <>
            <button
              onClick={() => handleNavigate(suggestedMatch!.idea.id)}
              disabled={saving}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={12} />
              Match “{suggestedMatch!.idea.text}”
            </button>
            <button
              onClick={() => handleNavigate(suggestedMatch!.idea.id, smartView!)}
              disabled={saving}
              className="flex cursor-pointer items-center gap-1 rounded-lg bg-gray-100 px-2 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ArrowRight size={11} />
              Go to {getRevealLabel(smartView!)}
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={saving || hasMarked}
              title={hasMarked ? "Already processed" : undefined}
              className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <Plus size={11} />
              Create new
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => void handleCreate()}
              disabled={saving || hasMarked}
              title={hasMarked ? "Already processed" : undefined}
              className="flex cursor-pointer items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={11} />
              Create new
            </button>
          </>
        )}
        <div className="relative" ref={overflowRef}>
          <button
            onClick={() => {
              setOverflowOpen(!overflowOpen);
              setRevealSubmenuOpen(false);
            }}
            disabled={saving}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="More actions"
          >
            <MoreHorizontal size={14} />
          </button>
          {overflowOpen && (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-gray-800">
              {revealSubmenuOpen ? (
                <>
                  <button
                    onClick={() => setRevealSubmenuOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                  >
                    <ChevronLeft size={12} />
                    Back
                  </button>
                  <div className="my-1 border-t border-black/5 dark:border-white/5" />
                  <SelectionRevealOption
                    view="planner"
                    icon={<LayoutDashboard size={12} />}
                    label="Daily Planner"
                    ideaId={suggestedMatch?.idea.id}
                    onSelect={handleNavigate}
                  />
                  <SelectionRevealOption
                    view="timeline"
                    icon={<CalendarDays size={12} />}
                    label="Timeline"
                    ideaId={suggestedMatch?.idea.id}
                    onSelect={handleNavigate}
                  />
                  <SelectionRevealOption
                    view="horizon"
                    icon={<Telescope size={12} />}
                    label="Horizon"
                    ideaId={suggestedMatch?.idea.id}
                    onSelect={handleNavigate}
                  />
                  <SelectionRevealOption
                    view="brainstorm"
                    icon={<BrainCircuit size={12} />}
                    label="Brainstorm"
                    ideaId={suggestedMatch?.idea.id}
                    onSelect={handleNavigate}
                  />
                  <SelectionRevealOption
                    view="projects"
                    icon={<FolderKanban size={12} />}
                    label="Projects"
                    ideaId={suggestedMatch?.idea.id}
                    onSelect={handleNavigate}
                  />
                  <SelectionRevealOption
                    view="goals"
                    icon={<Target size={12} />}
                    label="Goals"
                    ideaId={suggestedMatch?.idea.id}
                    onSelect={handleNavigate}
                  />
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setOverflowOpen(false);
                      setPickerMode("create_under");
                    }}
                    disabled={saving || hasMarked}
                    title={hasMarked ? "Already processed" : undefined}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                  >
                    <GitBranch size={12} />
                    Create under…
                  </button>
                  {hasMatch && (
                    <button
                      onClick={() => setRevealSubmenuOpen(true)}
                      disabled={saving}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                    >
                      <Eye size={12} />
                      Reveal in…
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectionRevealOption({
  view,
  icon,
  label,
  ideaId,
  onSelect,
}: {
  view: RevealView;
  icon: React.ReactNode;
  label: string;
  ideaId: string | undefined;
  onSelect: (ideaId: string, view: RevealView) => void;
}) {
  return (
    <button
      onClick={() => ideaId && onSelect(ideaId, view)}
      disabled={!ideaId}
      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.03] disabled:opacity-40 dark:text-gray-300 dark:hover:bg-white/[0.04]"
    >
      {icon}
      {label}
    </button>
  );
}

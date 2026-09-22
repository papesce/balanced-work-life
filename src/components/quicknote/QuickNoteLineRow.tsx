"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  GitBranch,
  Search,
  Trash2,
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
import { useQuickNoteContext } from "@/contexts/QuickNoteContext";
import { NoteLine, MatchResult } from "@/lib/quickNotes";
import { Idea } from "@/lib/types";
import { getRevealHref, getSmartRevealView, getRevealLabel, type RevealView } from "@/lib/reveal";
import { IdeaSearchPicker } from "@/components/brainstorm/IdeaSearchPicker";

type PickerMode = null | "create_under" | "match";

interface LineOverflowMenuProps {
  hasMatch: boolean;
  saving: boolean;
  localText: string;
  overflowRef: React.RefObject<HTMLDivElement | null>;
  overflowOpen: boolean;
  setOverflowOpen: (open: boolean) => void;
  setPickerMode: (mode: PickerMode) => void;
  setRevealSubmenuOpen: (open: boolean) => void;
  revealSubmenuOpen: boolean;
  handleNavigate: (view: RevealView) => void;
  handleDiscard: () => void;
}

function LineOverflowMenu({
  hasMatch,
  saving,
  localText,
  overflowRef,
  overflowOpen,
  setOverflowOpen,
  setPickerMode,
  setRevealSubmenuOpen,
  revealSubmenuOpen,
  handleNavigate,
  handleDiscard,
}: LineOverflowMenuProps) {
  return (
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
              <RevealOption
                view="planner"
                icon={<LayoutDashboard size={12} />}
                label="Daily Planner"
                onSelect={handleNavigate}
              />
              <RevealOption
                view="timeline"
                icon={<CalendarDays size={12} />}
                label="Timeline"
                onSelect={handleNavigate}
              />
              <RevealOption
                view="horizon"
                icon={<Telescope size={12} />}
                label="Horizon"
                onSelect={handleNavigate}
              />
              <RevealOption
                view="brainstorm"
                icon={<BrainCircuit size={12} />}
                label="Brainstorm"
                onSelect={handleNavigate}
              />
              <RevealOption
                view="projects"
                icon={<FolderKanban size={12} />}
                label="Projects"
                onSelect={handleNavigate}
              />
              <RevealOption
                view="goals"
                icon={<Target size={12} />}
                label="Goals"
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
                disabled={saving || !localText.trim()}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                <GitBranch size={12} />
                Create under…
              </button>
              <button
                onClick={() => {
                  setOverflowOpen(false);
                  setPickerMode("match");
                }}
                disabled={saving || !localText.trim()}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                <Search size={12} />
                {hasMatch ? "Search manually…" : "Match existing…"}
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
              <div className="my-1 border-t border-black/5 dark:border-white/5" />
              <button
                onClick={() => {
                  setOverflowOpen(false);
                  void handleDiscard();
                }}
                disabled={saving}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
              >
                <Trash2 size={12} />
                Discard
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface QuickNoteLineRowProps {
  line: NoteLine;
  suggestedMatch: MatchResult | null;
  allIdeas: Idea[];
  autoFocus?: boolean;
  onResolved?: () => void;
  /** When true, the line text is read-only but actions (match, create, discard) remain available. */
  readonly?: boolean;
}

export function QuickNoteLineRow({
  line,
  suggestedMatch,
  allIdeas,
  autoFocus,
  onResolved,
  readonly = false,
}: QuickNoteLineRowProps) {
  const router = useRouter();
  const { resolveLine, updateLineText, closePanel } = useQuickNoteContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localText, setLocalText] = useState(line.text);
  const [saving, setSaving] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [revealSubmenuOpen, setRevealSubmenuOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newText = e.target.value;
      setLocalText(newText);
      updateLineText(line.index, newText);
    },
    [updateLineText, line.index],
  );

  const handleCreate = useCallback(async () => {
    setSaving(true);
    await resolveLine(line.index, { type: "create", expectedText: line.text, text: localText });
    setSaving(false);
    onResolved?.();
  }, [resolveLine, line.index, line.text, localText, onResolved]);

  const handleCreateUnder = useCallback(
    async (parentId: string) => {
      setPickerMode(null);
      setSaving(true);
      await resolveLine(line.index, {
        type: "create_under",
        expectedText: line.text,
        parentId,
        text: localText,
      });
      setSaving(false);
      onResolved?.();
    },
    [resolveLine, line.index, line.text, localText, onResolved],
  );

  const handleMatch = useCallback(
    async (ideaId: string) => {
      setPickerMode(null);
      setSaving(true);
      await resolveLine(line.index, { type: "match", expectedText: line.text, ideaId });
      setSaving(false);
      onResolved?.();
    },
    [resolveLine, line.index, line.text, onResolved],
  );

  const handleDiscard = useCallback(async () => {
    setSaving(true);
    await resolveLine(line.index, { type: "discard", expectedText: line.text });
    setSaving(false);
    onResolved?.();
  }, [resolveLine, line.index, line.text, onResolved]);

  const handleAcceptMatch = useCallback(() => {
    if (suggestedMatch) {
      void handleMatch(suggestedMatch.idea.id);
    }
  }, [suggestedMatch, handleMatch]);

  const handleNavigate = useCallback(
    (view: RevealView) => {
      if (!suggestedMatch) return;
      const href = getRevealHref(view, suggestedMatch.idea, allIdeas);
      closePanel();
      router.push(href);
    },
    [suggestedMatch, allIdeas, closePanel, router],
  );

  const handleSmartNavigate = useCallback(() => {
    if (!suggestedMatch) return;
    const view = getSmartRevealView(suggestedMatch.idea, allIdeas);
    handleNavigate(view);
  }, [suggestedMatch, allIdeas, handleNavigate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (suggestedMatch) {
          handleAcceptMatch();
        } else {
          void handleCreate();
        }
      }
    },
    [handleCreate, handleAcceptMatch, suggestedMatch],
  );

  const hasMatch = suggestedMatch && suggestedMatch.score >= 0.6;
  const smartView = hasMatch ? getSmartRevealView(suggestedMatch!.idea, allIdeas) : null;

  if (pickerMode) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-black/5 bg-white/60 p-2 dark:border-white/5 dark:bg-white/[0.02]">
        <input
          ref={inputRef}
          type="text"
          value={localText}
          onChange={handleTextChange}
          className="flex-1 bg-transparent px-1.5 py-1 text-sm text-gray-800 outline-none focus:ring-1 focus:ring-violet-500/40 dark:text-gray-200"
          readOnly={readonly}
          disabled={saving}
        />
        {pickerMode === "create_under" && (
          <div className="rounded-lg border border-black/5 bg-white/80 p-2 dark:border-white/5 dark:bg-gray-800/80">
            <p className="mb-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400">
              Choose parent idea
            </p>
            <IdeaSearchPicker
              ideas={allIdeas}
              placeholder="Search for a parent idea..."
              matchAllWords
              renderActions={(idea, clearSearch) => (
                <button
                  onClick={() => {
                    void handleCreateUnder(idea.id);
                    clearSearch();
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
              className="mt-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        )}
        {pickerMode === "match" && (
          <div className="rounded-lg border border-black/5 bg-white/80 p-2 dark:border-white/5 dark:bg-gray-800/80">
            <p className="mb-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400">
              Match to existing idea
            </p>
            <IdeaSearchPicker
              ideas={allIdeas}
              initialQuery={localText}
              matchAllWords
              placeholder="Search for a matching idea..."
              renderActions={(idea, clearSearch) => (
                <button
                  onClick={() => {
                    void handleMatch(idea.id);
                    clearSearch();
                  }}
                  className="flex cursor-pointer items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-600 hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-400"
                >
                  <Check size={10} />
                  Match
                </button>
              )}
            />
            <button
              onClick={() => setPickerMode(null)}
              className="mt-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-black/5 bg-white/60 p-2 dark:border-white/5 dark:bg-white/[0.02]">
      <input
        ref={inputRef}
        type="text"
        value={localText}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        className="flex-1 bg-transparent px-1.5 py-1 text-sm text-gray-800 outline-none focus:ring-1 focus:ring-violet-500/40 dark:text-gray-200"
        readOnly={readonly}
        disabled={saving}
      />

      {hasMatch ? (
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={handleAcceptMatch}
            disabled={saving}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-600 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
          >
            <Check size={12} />
            Match &quot;{suggestedMatch!.idea.text}&quot;
          </button>

          <button
            onClick={handleSmartNavigate}
            disabled={saving}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-gray-100 px-2 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ArrowRight size={11} />
            Go to {getRevealLabel(smartView!)}
          </button>

          <button
            onClick={handleCreate}
            disabled={saving || !localText.trim()}
            className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <Plus size={11} />
            Create new
          </button>

          <LineOverflowMenu
            hasMatch
            saving={saving}
            localText={localText}
            overflowRef={overflowRef}
            overflowOpen={overflowOpen}
            setOverflowOpen={setOverflowOpen}
            setPickerMode={setPickerMode}
            setRevealSubmenuOpen={setRevealSubmenuOpen}
            revealSubmenuOpen={revealSubmenuOpen}
            handleNavigate={handleNavigate}
            handleDiscard={handleDiscard}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={handleCreate}
            disabled={saving || !localText.trim()}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-600 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
          >
            <Plus size={11} />
            Create new
          </button>

          <button
            onClick={() => setPickerMode("match")}
            disabled={saving || !localText.trim()}
            className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <Search size={11} />
            Search existing…
          </button>

          <LineOverflowMenu
            hasMatch={false}
            saving={saving}
            localText={localText}
            overflowRef={overflowRef}
            overflowOpen={overflowOpen}
            setOverflowOpen={setOverflowOpen}
            setPickerMode={setPickerMode}
            setRevealSubmenuOpen={setRevealSubmenuOpen}
            revealSubmenuOpen={revealSubmenuOpen}
            handleNavigate={handleNavigate}
            handleDiscard={handleDiscard}
          />
        </div>
      )}
    </div>
  );
}

function RevealOption({
  view,
  icon,
  label,
  onSelect,
}: {
  view: RevealView;
  icon: React.ReactNode;
  label: string;
  onSelect: (view: RevealView) => void;
}) {
  return (
    <button
      onClick={() => onSelect(view)}
      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
    >
      {icon}
      {label}
    </button>
  );
}

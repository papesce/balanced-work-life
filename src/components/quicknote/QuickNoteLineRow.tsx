"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@powersync/react";
import { useAuth } from "@/hooks/useAuth";
import { Plus, GitBranch, Search, Trash2, Check } from "lucide-react";
import { useQuickNoteContext } from "@/contexts/QuickNoteContext";
import { NoteLine } from "@/lib/quickNotes";
import { Idea } from "@/lib/types";
import { IdeaSearchPicker } from "@/components/brainstorm/IdeaSearchPicker";

type PickerMode = null | "create_under" | "match";

interface QuickNoteLineRowProps {
  line: NoteLine;
}

export function QuickNoteLineRow({ line }: QuickNoteLineRowProps) {
  const { user } = useAuth();
  const { resolveLine, updateLineText } = useQuickNoteContext();
  const [localText, setLocalText] = useState(line.text);
  const [saving, setSaving] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);

  // Load ideas for the picker (only when picker is open)
  const { data: ideaRows } = useQuery<Record<string, unknown>>(
    pickerMode && user
      ? "SELECT * FROM ideas WHERE user_id = ? ORDER BY sort_order ASC"
      : "SELECT * FROM ideas WHERE 0",
    pickerMode && user ? [user.id] : [],
  );
  const ideas: Idea[] = (ideaRows as unknown as Idea[]) ?? [];

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
  }, [resolveLine, line.index, line.text, localText]);

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
    },
    [resolveLine, line.index, line.text, localText],
  );

  const handleMatch = useCallback(
    async (ideaId: string) => {
      setPickerMode(null);
      setSaving(true);
      await resolveLine(line.index, { type: "match", expectedText: line.text, ideaId });
      setSaving(false);
    },
    [resolveLine, line.index, line.text],
  );

  const handleDiscard = useCallback(async () => {
    setSaving(true);
    await resolveLine(line.index, { type: "discard", expectedText: line.text });
    setSaving(false);
  }, [resolveLine, line.index, line.text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleCreate();
      }
    },
    [handleCreate],
  );

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-black/5 bg-white/60 p-2 dark:border-white/5 dark:bg-white/[0.02]">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={localText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent px-1.5 py-1 text-sm text-gray-800 outline-none focus:ring-1 focus:ring-violet-500/40 dark:text-gray-200"
          disabled={saving}
        />
      </div>

      {!pickerMode && (
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={handleCreate}
            disabled={saving || !localText.trim()}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-600 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
          >
            <Plus size={11} />
            Create
          </button>
          <button
            onClick={() => setPickerMode("create_under")}
            disabled={saving || !localText.trim()}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <GitBranch size={11} />
            Create under…
          </button>
          <button
            onClick={() => setPickerMode("match")}
            disabled={saving || !localText.trim()}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <Search size={11} />
            Match existing
          </button>
          {/* EXTENSION POINT: idea_comments ("also add as comment") — when the idea_comments
              table exists, add a checkbox here that inserts a comment row on the matched idea. */}
          <button
            onClick={handleDiscard}
            disabled={saving}
            className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <Trash2 size={11} />
            Discard
          </button>
        </div>
      )}

      {pickerMode === "create_under" && (
        <div className="rounded-lg border border-black/5 bg-white/80 p-2 dark:border-white/5 dark:bg-gray-800/80">
          <p className="mb-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400">
            Choose parent idea
          </p>
          <IdeaSearchPicker
            ideas={ideas}
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
            ideas={ideas}
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

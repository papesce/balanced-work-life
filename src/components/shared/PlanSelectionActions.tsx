"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { parseTaskAll, isTaskLine } from "@/lib/quickNotes";
import type { IdeaType } from "@/lib/types";

/**
 * Phase 1 plan support: create a child idea/task from selected notes text.
 * First line = title ([title](notes) + trailing #type honored), rest = notes.
 * Parent defaults to the idea whose notes are being edited (project plan).
 */
export function PlanSelectionActions({
  selection,
  parentId,
  onDone,
  onCreated,
}: {
  selection: string;
  parentId: string;
  onDone: () => void;
  onCreated?: (id: string) => void;
}) {
  const { createIdea } = useIdeas();
  const [saving, setSaving] = useState(false);
  const [kindOverride, setKindOverride] = useState<IdeaType | null>(null);
  const [createdLabel, setCreatedLabel] = useState<string | null>(null);

  const firstLine = useMemo(
    () =>
      selection
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)[0] ?? "",
    [selection],
  );
  const parsed = useMemo(() => parseTaskAll(firstLine), [firstLine]);
  const effectiveKind: IdeaType =
    kindOverride ?? parsed.kind ?? (isTaskLine(firstLine) ? "task" : "task");

  const preview = selection.length > 120 ? selection.slice(0, 120).trimEnd() + "…" : selection;

  const handleCreate = async () => {
    const lines = selection
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    // Strip a leading "- " so plan bullets become clean titles.
    const rawFirst = lines[0].replace(/^\s*-\s?/, "");
    const { title, detail, kind } = parseTaskAll(rawFirst);
    const rest = lines.slice(1).join("\n");
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    setSaving(true);
    try {
      const combinedNotes = [detail, rest].filter(Boolean).join("\n") || null;
      const id = await createIdea(cleanTitle, parentId, "bottom", {
        type: (kindOverride ?? kind ?? "task") as IdeaType,
        status: "draft",
        notes: combinedNotes,
      });
      if (id) {
        setCreatedLabel(`Created ${effectiveKind}: ${cleanTitle}`);
        onCreated?.(id);
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 p-2 dark:border-indigo-500/30 dark:bg-indigo-500/10">
      <p className="truncate px-1 text-[11px] text-gray-500 dark:text-gray-400">“{preview}”</p>
      <div className="flex flex-wrap items-center gap-1">
        <select
          value={effectiveKind}
          onChange={(e) => setKindOverride(e.target.value as IdeaType)}
          disabled={saving}
          aria-label="New item type"
          className="cursor-pointer rounded-lg border border-black/10 bg-white px-1.5 py-1 text-[11px] font-medium text-gray-600 outline-none disabled:opacity-40 dark:border-white/10 dark:bg-gray-800 dark:text-gray-300"
        >
          {(["task", "idea", "initiative"] as IdeaType[]).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <button
          onClick={() => void handleCreate()}
          disabled={saving || !firstLine.trim()}
          className="flex cursor-pointer items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={11} />
          {saving ? "Creating…" : `Create ${effectiveKind} as child`}
        </button>
        <button
          onClick={onDone}
          disabled={saving}
          className="rounded-lg px-2 py-1.5 text-[11px] text-gray-400 hover:bg-black/5 hover:text-gray-600 disabled:opacity-40 dark:hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
      {createdLabel && (
        <p className="px-1 text-[11px] text-emerald-600 dark:text-emerald-400">{createdLabel}</p>
      )}
      <p className="px-1 text-[10px] text-gray-400 dark:text-gray-500">
        First line becomes the title · supports [title](notes) and trailing #task #idea #initiative
      </p>
    </div>
  );
}

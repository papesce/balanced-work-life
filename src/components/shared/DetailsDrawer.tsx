"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  X,
  StickyNote,
  Telescope,
  ChevronDown,
  ChevronRight,
  Check,
  Layers,
  Network,
  CornerUpLeft,
  Link2,
} from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useClassifications } from "@/hooks/useClassifications";
import { getRevealHref } from "@/lib/reveal";
import type { Idea, IdeaLink } from "@/lib/types";
import { DetailsEditor } from "./DetailsEditor";

export type DetailsSection = "notes" | "context";

/** Direction-aware label for a link as seen from `ideaId`. */
function linkLabelFor(link: IdeaLink, ideaId: string): string {
  const outgoing = link.source_id === ideaId;
  switch (link.link_type) {
    case "depends_on":
      return outgoing ? "Depends on" : "Required by";
    case "contributes_to":
      return outgoing ? "Contributes to" : "Supported by";
    case "part_of":
      return outgoing ? "Part of" : "Includes";
    case "unblocks":
      return outgoing ? "Unblocks" : "Unblocked by";
    case "related_to":
    default:
      return "Related to";
  }
}

const LINK_GROUP_ORDER = [
  "Depends on",
  "Required by",
  "Unblocks",
  "Unblocked by",
  "Contributes to",
  "Supported by",
  "Part of",
  "Includes",
  "Related to",
];

export function DetailsDrawer({
  ideaId,
  initialSection = "notes",
  onClose,
}: {
  ideaId: string | null;
  initialSection?: DetailsSection;
  onClose: () => void;
}) {
  const { ideas, updateIdea } = useIdeas();
  const idea = ideaId ? (ideas.find((i) => i.id === ideaId) ?? null) : null;
  const [mounted, setMounted] = useState(false);
  const [classificationOpen, setClassificationOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(initialSection === "context");
  const router = useRouter();
  const { schemes, options, getOptionForIdea, setClassification } = useClassifications();
  const { links } = useIdeaLinks();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContextOpen(initialSection === "context");
  }, [ideaId, initialSection]);

  useEffect(() => {
    if (!ideaId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [ideaId, onClose]);

  const ancestors = useMemo(() => {
    if (!idea) return [];
    const byId = new Map(ideas.map((i) => [i.id, i]));
    const chain: Idea[] = [];
    let cur: Idea | undefined = idea;
    while (cur?.parent_id) {
      const parent = byId.get(cur.parent_id);
      if (!parent) break;
      chain.push(parent);
      cur = parent;
    }
    return chain;
  }, [idea, ideas]);

  const linkedGroups = useMemo(() => {
    if (!idea) return [];
    const byId = new Map(ideas.map((i) => [i.id, i]));
    const groups = new Map<string, { other: Idea; link: IdeaLink }[]>();
    for (const link of links) {
      if (link.source_id !== idea.id && link.target_id !== idea.id) continue;
      const otherId = link.source_id === idea.id ? link.target_id : link.source_id;
      const other = byId.get(otherId);
      if (!other) continue;
      const label = linkLabelFor(link, idea.id);
      const list = groups.get(label) ?? [];
      list.push({ other, link });
      groups.set(label, list);
    }
    return [...groups.entries()].sort(
      ([a], [b]) => LINK_GROUP_ORDER.indexOf(a) - LINK_GROUP_ORDER.indexOf(b),
    );
  }, [idea, ideas, links]);

  const linkedCount = linkedGroups.reduce((n, [, rows]) => n + rows.length, 0);

  const navigateToAncestor = (ancestor: Idea) => {
    if (ancestor.type === "project") {
      router.push(getRevealHref("projects", ancestor, ideas));
    } else if (ancestor.type === "objective") {
      router.push(getRevealHref("goals", ancestor, ideas));
    } else {
      const termValue = getOptionForIdea(ancestor.id, "term")?.value ?? null;
      router.push(getRevealHref("horizon", ancestor, ideas, termValue ?? "unclassified", "term"));
    }
    onClose();
  };

  const navigateToLinked = (other: Idea) => {
    router.push(getRevealHref("brainstorm", other));
    onClose();
  };

  if (!mounted || !ideaId || !idea) return null;

  const handleSave = async (next: string | null) => {
    await updateIdea(ideaId, { notes: next });
  };

  const classificationSummary = schemes
    .map((s) => getOptionForIdea(idea.id, s.key)?.label)
    .filter(Boolean)
    .join(" · ");

  const termValue = getOptionForIdea(idea.id, "term")?.value ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex h-full w-full max-w-[420px] flex-col bg-white shadow-xl sm:w-[420px] dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/5">
          <div className="flex items-center gap-2">
            <StickyNote size={16} className="text-indigo-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Details</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p
            className="mb-3 truncate text-xs font-medium text-gray-500 dark:text-gray-400"
            title={idea.text}
          >
            {idea.text || "Untitled"}
          </p>

          {/* Context Section: containment vs association, never tree rows */}
          <div className="mb-4 rounded-lg border border-black/5 dark:border-white/5">
            <button
              onClick={() => setContextOpen(!contextOpen)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              <Network size={14} className="text-indigo-500" />
              <span className="flex-1">Context</span>
              <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                {ancestors.length + linkedCount > 0 ? (
                  <span>
                    {ancestors.length + linkedCount} relation
                    {ancestors.length + linkedCount > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="italic">No relations</span>
                )}
                {contextOpen ? (
                  <ChevronDown size={12} strokeWidth={1.5} />
                ) : (
                  <ChevronRight size={12} strokeWidth={1.5} />
                )}
              </span>
            </button>

            {contextOpen && (
              <div className="border-t border-black/5 px-3 py-2 dark:border-white/5">
                <p className="mb-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
                  Contained in
                </p>
                {ancestors.length === 0 ? (
                  <p className="mb-2 px-2 py-1 text-xs text-gray-400 italic">
                    Top-level — no parent project or goal.
                  </p>
                ) : (
                  <div className="mb-2 space-y-1">
                    {ancestors.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => navigateToAncestor(a)}
                        title={`Reveal ${a.text || "Untitled"} in its own view`}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-600 hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.04]"
                      >
                        <CornerUpLeft
                          size={12}
                          strokeWidth={1.5}
                          className="shrink-0 text-gray-400"
                        />
                        <span className="min-w-0 flex-1 truncate">{a.text || "Untitled"}</span>
                        {a.type && (
                          <span className="shrink-0 rounded-full border border-black/10 px-1.5 py-px text-[10px] font-medium text-gray-500 capitalize dark:border-white/10 dark:text-gray-400">
                            {a.type}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <p className="mb-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
                  Related
                </p>
                {linkedGroups.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-gray-400 italic">
                    No links yet — create one from the … → Link… menu.
                  </p>
                ) : (
                  linkedGroups.map(([label, rows]) => (
                    <div key={label} className="mb-2 last:mb-0">
                      <p className="mb-1 px-2 text-[10px] font-medium text-gray-400">{label}</p>
                      <div className="space-y-1">
                        {rows.map(({ other, link }) => (
                          <button
                            key={link.id}
                            onClick={() => navigateToLinked(other)}
                            title={`Open ${other.text || "Untitled"}`}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-600 hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.04]"
                          >
                            <Link2 size={12} strokeWidth={1.5} className="shrink-0 text-gray-400" />
                            <span className="min-w-0 flex-1 truncate">
                              {other.text || "Untitled"}
                            </span>
                            {other.type && (
                              <span className="shrink-0 rounded-full border border-black/10 px-1.5 py-px text-[10px] font-medium text-gray-500 capitalize dark:border-white/10 dark:text-gray-400">
                                {other.type}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Classification Section */}
          <div className="mb-4 rounded-lg border border-black/5 dark:border-white/5">
            <button
              onClick={() => setClassificationOpen(!classificationOpen)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              <Layers size={14} className="text-indigo-500" />
              <span className="flex-1">Classification</span>
              <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                {classificationSummary ? (
                  <span className="max-w-[220px] truncate">{classificationSummary}</span>
                ) : (
                  <span className="italic">Not classified</span>
                )}
                {classificationOpen ? (
                  <ChevronDown size={12} strokeWidth={1.5} />
                ) : (
                  <ChevronRight size={12} strokeWidth={1.5} />
                )}
              </span>
            </button>

            {classificationOpen && (
              <div className="border-t border-black/5 px-3 py-2 dark:border-white/5">
                {schemes.map((scheme) => {
                  const schemeOptions = options.filter((o) => o.scheme_id === scheme.id);
                  const current = getOptionForIdea(idea.id, scheme.key);
                  return (
                    <div key={scheme.id} className="mb-2 last:mb-0">
                      <p className="mb-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
                        {scheme.label}
                      </p>
                      {schemeOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setClassification(idea.id, scheme.key, option.value)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-600 hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.04]"
                        >
                          <span className="w-4">
                            {current?.id === option.id && (
                              <Check size={12} strokeWidth={2} className="text-indigo-500" />
                            )}
                          </span>
                          {option.label}
                        </button>
                      ))}
                      {current && (
                        <>
                          <div className="my-1 border-t border-black/5 dark:border-white/5" />
                          <button
                            onClick={() => setClassification(idea.id, scheme.key, null)}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-600 hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.04]"
                          >
                            <span className="w-4" />
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
                {schemes.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-gray-400 italic">Loading frameworks…</p>
                )}
                {termValue && (
                  <button
                    onClick={() => {
                      router.push(getRevealHref("horizon", idea, ideas, termValue, "term"));
                      onClose();
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10"
                  >
                    <Telescope size={12} strokeWidth={1.5} />
                    Reveal in Horizon
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notes Section */}
          <DetailsEditor value={idea.notes} onSave={handleSave} />
          <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
            ⌘+Enter to save · Esc to close
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

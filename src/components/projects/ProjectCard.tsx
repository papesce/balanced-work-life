"use client";

import { useState } from "react";
import { Check, ChevronDown, FolderKanban } from "lucide-react";
import {
  AREA_DOT_COLORS,
  AREA_ICONS,
  AREA_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/constants";
import type { Idea, IdeaLink, IdeaStatus, IdeaType, LifeArea, LinkType, Tag } from "@/lib/types";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";
import { PriorityChip, type PriorityValue } from "@/components/shared/PriorityChip";
import { TagPicker } from "@/components/shared/TagPicker";
import { IdeaActionMenu } from "@/components/shared/IdeaActionMenu";
import { NotesIndicator } from "@/components/shared/NotesIndicator";
import { areaColors } from "@/styles/tokens";

export interface ProjectCardGroupOption {
  key: string | null;
  label: string;
}

interface ProjectCardProps {
  project: Idea;
  done: number;
  total: number;
  area: string | null;
  areaTags: Tag[];
  allTags: Tag[];
  priority: PriorityValue;
  lensKey: string;
  lensLabel: string;
  groupValue: string | null;
  groupOptions: ProjectCardGroupOption[];
  groupHint: string | null;
  renaming: boolean;
  renameDraft: string;
  expanded: boolean;
  hideCompleted: boolean;
  /** Direct child tasks, shown as a preview when expanded. */
  tasks: Idea[];
  allIdeas: Idea[];
  links: IdeaLink[];
  hasChildren: boolean;
  getTagsForIdea: (ideaId: string) => Tag[];
  onSelect: (id: string) => void;
  onStartRename: (p: Idea) => void;
  onRenameDraftChange: (v: string) => void;
  onCommitRename: (id: string) => void;
  onCancelRename: () => void;
  onSetPriority: (id: string, v: string | null) => void;
  onSetClassification: (id: string, v: string | null) => void;
  onReplaceAreaTag: (projectId: string, tag: Tag) => void;
  onRemoveAreaTag: (projectId: string, tagId: string) => void;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  onToggleExpand: (id: string) => void;
  onQuickAddTask: (projectId: string) => void;
  onUpdateStatus: (id: string, status: IdeaStatus) => void;
  onToggleTask: (id: string, completed: boolean) => void;
  onDelete: (id: string) => Promise<void>;
  onSchedule: (id: string, date: string | null) => Promise<void>;
  onCreateLink: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onMove: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  onCreateParent: (id: string, text: string, type: IdeaType) => Promise<string | null>;
  onMoved: (parentIdToExpand: string | null) => void;
  onOpenNotes: (id: string) => void;
}

export function ProjectCard({
  project: p,
  done,
  total,
  area,
  areaTags,
  allTags,
  priority,
  lensKey,
  lensLabel,
  groupValue,
  groupOptions,
  groupHint,
  renaming,
  renameDraft,
  expanded,
  hideCompleted,
  tasks,
  allIdeas,
  links,
  hasChildren,
  getTagsForIdea,
  onSelect,
  onStartRename,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
  onSetPriority,
  onSetClassification,
  onReplaceAreaTag,
  onRemoveAreaTag,
  onCreateTag,
  onToggleExpand,
  onQuickAddTask,
  onUpdateStatus,
  onToggleTask,
  onDelete,
  onSchedule,
  onCreateLink,
  onDeleteLink,
  onMove,
  onCreateParent,
  onMoved,
  onOpenNotes,
}: ProjectCardProps) {
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [statusPickerPos, setStatusPickerPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [areaPickerPos, setAreaPickerPos] = useState<{ top: number; left: number } | null>(null);

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const AreaIcon = area ? AREA_ICONS[area as keyof typeof AREA_ICONS] : null;
  const visible = hideCompleted ? tasks.filter((k) => k.status !== "completed") : tasks;
  const preview = visible.slice(0, 5);

  return (
    <div
      onClick={() => onSelect(p.id)}
      onKeyDown={(e) => {
        if (renaming) return;
        if (e.key === "Enter" || e.key === " ") onSelect(p.id);
        else if (e.key === "e" || e.key === "F2") {
          e.preventDefault();
          onStartRename(p);
        } else if (e.key === "a") {
          e.preventDefault();
          void onQuickAddTask(p.id);
        }
      }}
      role="button"
      tabIndex={0}
      className={`glass-card group flex w-full cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition hover:border-violet-200 dark:hover:border-violet-800 ${
        priority === "high"
          ? "border-violet-300 shadow-[0_0_0_1px_rgba(139,92,246,0.35),0_8px_24px_rgba(139,92,246,0.12)] dark:border-violet-700"
          : "border-black/5 dark:border-white/5"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30">
            <FolderKanban size={16} />
            {area && (
              <span
                title={AREA_LABELS[area as keyof typeof AREA_LABELS] ?? area}
                className={`absolute -right-1 -bottom-1 h-3 w-3 rounded-full border-2 border-white ${AREA_DOT_COLORS[area as keyof typeof AREA_DOT_COLORS] ?? "bg-gray-400"} dark:border-gray-900`}
              />
            )}
          </span>
          <div className="min-w-0">
            {renaming ? (
              <span
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => onRenameDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void onCommitRename(p.id);
                    if (e.key === "Escape") onCancelRename();
                  }}
                  onBlur={() => void onCommitRename(p.id)}
                  aria-label={`Rename ${p.text || "untitled project"}`}
                  className="w-full min-w-0 rounded-md border border-violet-300 px-1.5 py-0.5 text-sm font-semibold focus:ring-2 focus:ring-violet-500/30 focus:outline-none dark:border-violet-700 dark:bg-gray-800"
                />
                <button
                  onClick={() => void onCommitRename(p.id)}
                  aria-label="Save name"
                  className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                >
                  <Check size={13} />
                </button>
              </span>
            ) : (
              <p
                className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-800 dark:text-gray-100"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onStartRename(p);
                }}
                title="Double-click to rename"
              >
                <PriorityChip value={priority} onSelect={(v) => void onSetPriority(p.id, v)} />
                {AreaIcon && (
                  <AreaIcon
                    size={12}
                    className="shrink-0"
                    style={{ color: area ? areaColors[area]?.dot : undefined }}
                  />
                )}
                {p.text || "Untitled project"}
              </p>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
              <span className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setStatusPickerPos({ top: rect.bottom + 4, left: rect.left });
                    setStatusPickerOpen((v) => !v);
                  }}
                  className={`rounded-full border px-1.5 py-0 text-[10px] font-semibold whitespace-nowrap transition hover:opacity-80 ${STATUS_STYLES[p.status]}`}
                >
                  {STATUS_LABELS[p.status] ?? p.status}
                </button>
                {statusPickerOpen && statusPickerPos && (
                  <StatusPicker
                    current={p.status}
                    onSelect={(s: IdeaStatus) => {
                      setStatusPickerOpen(false);
                      void onUpdateStatus(p.id, s);
                    }}
                    onClose={() => setStatusPickerOpen(false)}
                    position={statusPickerPos}
                  />
                )}
              </span>
              <span>
                {done}/{total} done
                {p.scheduled_date ? ` · ${p.scheduled_date}` : ""}
              </span>
              {lensKey !== "area" && (
                <span onClick={(e) => e.stopPropagation()}>
                  <select
                    aria-label={`Change ${lensLabel} for ${p.text || "untitled project"}`}
                    title={groupHint ?? undefined}
                    value={groupValue ?? ""}
                    onChange={(e) => void onSetClassification(p.id, e.target.value || null)}
                    className="max-w-[110px] cursor-pointer rounded-md border border-black/10 bg-transparent px-1 py-0 text-[10px] font-semibold text-gray-500 dark:border-white/10 dark:text-gray-400"
                  >
                    <option value="">—</option>
                    {groupOptions
                      .filter((c) => c.key !== null)
                      .map((o) => (
                        <option key={o.key} value={o.key ?? ""}>
                          {o.label}
                        </option>
                      ))}
                  </select>
                </span>
              )}
              {lensKey === "area" && (
                <span className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setAreaPickerPos({ top: rect.bottom + 4, left: rect.left });
                      setAreaPickerOpen((v) => !v);
                    }}
                    title={groupHint ?? undefined}
                    className="cursor-pointer rounded-md border border-black/10 px-1 py-0 text-[10px] font-semibold text-gray-500 dark:border-white/10 dark:text-gray-400"
                  >
                    {area ? (AREA_LABELS[area as keyof typeof AREA_LABELS] ?? area) : "Set area"}
                  </button>
                  {areaPickerOpen && areaPickerPos && (
                    <TagPicker
                      allTags={allTags}
                      selectedTags={areaTags}
                      onAdd={(tag) => {
                        setAreaPickerOpen(false);
                        void onReplaceAreaTag(p.id, tag);
                      }}
                      onRemove={(tagId) => {
                        void onRemoveAreaTag(p.id, tagId);
                      }}
                      onCreateTag={onCreateTag}
                      onClose={() => setAreaPickerOpen(false)}
                      singleSelect
                      fixedPosition={areaPickerPos}
                    />
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onToggleExpand(p.id)}
            title={expanded ? "Collapse tasks" : "Expand tasks"}
            aria-label={expanded ? "Collapse tasks" : "Expand tasks"}
            aria-expanded={expanded}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-violet-600"
          >
            <ChevronDown
              size={14}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          <IdeaActionMenu
            idea={p}
            allIdeas={allIdeas}
            links={links}
            hasChildren={hasChildren}
            getTagsForIdea={getTagsForIdea}
            onEdit={() => onStartRename(p)}
            onDelete={onDelete}
            onSchedule={onSchedule}
            onCreateLink={onCreateLink}
            onDeleteLink={onDeleteLink}
            onMove={onMove}
            onCreateParent={onCreateParent}
            onMoved={onMoved}
            onShowDetails={() => onOpenNotes(p.id)}
            currentView="projects"
          />
          <NotesIndicator hasNotes={!!p.notes?.trim()} onClick={() => onOpenNotes(p.id)} />
          <button
            onClick={() => onSelect(p.id)}
            className="text-xs font-semibold text-violet-600 hover:underline"
          >
            Open →
          </button>
        </div>
      </div>
      {total > 0 && (
        <div
          className="h-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress for ${p.text || "untitled project"}`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {expanded && (
        <div
          className="mt-1 space-y-1 border-t border-black/5 pt-2 dark:border-white/5"
          onClick={(e) => e.stopPropagation()}
        >
          {preview.length === 0 && (
            <p className="px-1 text-[11px] text-gray-400 italic">No tasks yet</p>
          )}
          {preview.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-1 text-xs">
              <input
                type="checkbox"
                checked={t.status === "completed"}
                onChange={() => void onToggleTask(t.id, t.status !== "completed")}
                aria-label={`Toggle ${t.text || "untitled task"}`}
                className="h-3.5 w-3.5 rounded accent-violet-600"
              />
              <button
                onClick={() => onSelect(t.type === "project" ? t.id : p.id)}
                title={t.type === "project" ? "Open nested project" : "Open in project"}
                className={`min-w-0 flex-1 truncate text-left hover:text-violet-600 ${
                  t.status === "completed"
                    ? "text-gray-400 line-through"
                    : "text-gray-700 dark:text-gray-200"
                }`}
              >
                {t.text || "Untitled"}
              </button>
              <span className="shrink-0 text-[10px] text-gray-400 capitalize">
                {t.status.replace("_", " ")}
              </span>
            </div>
          ))}
          {visible.length > preview.length && (
            <p className="px-1 text-[11px] text-gray-400">
              +{visible.length - preview.length} more
            </p>
          )}
          <div className="flex gap-2 px-1 pt-1">
            <button
              onClick={() => void onQuickAddTask(p.id)}
              className="rounded-lg border border-dashed border-black/10 px-2 py-1 text-[11px] font-semibold text-gray-500 hover:border-violet-300 hover:text-violet-600 dark:border-white/10"
            >
              + Add task
            </button>
            <button
              onClick={() => onSelect(p.id)}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-600 hover:bg-violet-50"
            >
              Open →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

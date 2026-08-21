"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IdeaNode as IdeaNodeType,
  Idea,
  IdeaLink,
  IdeaStatus,
  IdeaType,
  Tag,
  LifeArea,
} from "@/lib/types";
import { AREA_DOT_COLORS, STATUS_CONFIG, STATUS_LABELS, STATUS_STYLES } from "@/lib/constants";
import { TypePicker } from "./TypePicker";
import { StatusPicker } from "./StatusPicker";
import { TagPicker } from "@/components/shared/TagPicker";

const TYPE_COLORS: Record<IdeaType, string> = {
  idea: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700/30",
  objective:
    "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/30",
  project:
    "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/30",
  initiative:
    "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/30",
  task: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/30",
};

function formatScheduleDate(date: string, today: string): string {
  if (date === today) return "Hoy";
  const tomorrow = new Date(today + "T12:00:00");
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === tomorrow.toISOString().split("T")[0]) return "Mañana";
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" });
}

export function StatusIconSlot({
  node,
  onMarkDone,
  onMarkUndone,
}: {
  node: IdeaNodeType;
  onMarkDone: (id: string) => Promise<void>;
  onMarkUndone: (id: string) => Promise<void>;
}) {
  if (!STATUS_CONFIG[node.status].icon) return null;
  const Icon = STATUS_CONFIG[node.status].icon!;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (node.status === "completed" || node.status === "cancelled") {
          void onMarkUndone(node.id);
        } else {
          void onMarkDone(node.id);
        }
      }}
      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center ${STATUS_CONFIG[node.status].textClass}`}
    >
      <Icon size={14} strokeWidth={2.5} />
    </button>
  );
}

export function TypePillSlot({
  node,
  onUpdate,
}: {
  node: IdeaNodeType;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
}) {
  const [showPicker, setShowPicker] = useState(false);
  return (
    <div className="relative w-20 flex-shrink-0 text-center" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`rounded-full border px-2 py-0.5 text-xs ${
          node.type ? TYPE_COLORS[node.type] : "border-gray-200 text-gray-400"
        }`}
      >
        {node.type ? node.type.charAt(0).toUpperCase() + node.type.slice(1) : "—"}
      </button>
      {showPicker && (
        <TypePicker
          current={node.type}
          onSelect={(type) => {
            void onUpdate(node.id, { type });
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

export function TagChipsSlot({
  node,
  allTags,
  getTagsForIdea,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: {
  node: IdeaNodeType;
  allTags: Tag[];
  getTagsForIdea: (ideaId: string) => Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const nodeTags = getTagsForIdea(node.id);
  return (
    <div
      className="relative flex min-w-28 flex-shrink-0 items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {nodeTags.map((tag) => (
        <span
          key={tag.id}
          className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
            AREA_DOT_COLORS[tag.area] ? "border-current/20" : "border-gray-200 text-gray-400"
          }`}
          style={{ opacity: 0.85 }}
        >
          <span
            className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${AREA_DOT_COLORS[tag.area]}`}
          />
          {tag.name}
        </span>
      ))}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="rounded-full border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-400 hover:border-gray-400 hover:text-gray-600 dark:border-gray-700 dark:text-gray-500 dark:hover:border-gray-500 dark:hover:text-gray-300"
        title="Add tag"
      >
        {nodeTags.length === 0 ? "tag" : "+"}
      </button>
      {showPicker && (
        <TagPicker
          allTags={allTags}
          selectedTags={nodeTags}
          onAdd={(tag) => {
            void onAddTag(node.id, tag);
          }}
          onRemove={(tagId) => {
            void onRemoveTag(node.id, tagId);
          }}
          onCreateTag={onCreateTag}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

export function StatusPillSlot({
  node,
  onUpdate,
}: {
  node: IdeaNodeType;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const handleStatusSelect = async (status: IdeaStatus) => {
    const now = new Date().toISOString();
    setShowPicker(false);
    try {
      switch (status) {
        case "completed":
          await onUpdate(node.id, { status: "completed", completed_at: now });
          break;
        case "cancelled":
          await onUpdate(node.id, { status: "cancelled", cancelled_at: now });
          break;
        case "in_progress":
          await onUpdate(node.id, { status: "in_progress" });
          break;
        case "paused":
          await onUpdate(node.id, { status: "paused", paused_at: now });
          break;
        case "planned":
        case "scheduled":
        case "draft":
          await onUpdate(node.id, {
            status,
            completed_at: null,
            cancelled_at: null,
            paused_at: null,
          });
          break;
        case "archived":
          await onUpdate(node.id, { status: "archived" });
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      window.alert(`Couldn't change status to "${status}": ${message}`);
    }
  };

  return (
    <div className="relative w-20 flex-shrink-0 text-center" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[node.status]}`}
      >
        {STATUS_LABELS[node.status]}
      </button>
      {showPicker && (
        <div className="absolute top-full right-0 z-50 mt-1">
          <StatusPicker
            current={node.status}
            onSelect={handleStatusSelect}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}
    </div>
  );
}

export function LinkCountBadge({ nodeId, links }: { nodeId: string; links: IdeaLink[] }) {
  const linkCount = links.filter((l) => l.source_id === nodeId || l.target_id === nodeId).length;
  if (linkCount === 0) return null;
  return (
    <span className="flex-shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-300">
      {linkCount}
    </span>
  );
}

export function ScheduleChip({ node, todayString }: { node: IdeaNodeType; todayString: string }) {
  const router = useRouter();
  if (!node.scheduled_date) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/timeline?date=${node.scheduled_date}&highlight=${node.id}`);
      }}
      title="Open in timeline"
      className={`flex w-20 flex-shrink-0 items-center justify-center truncate rounded-full border px-1.5 py-0.5 text-xs transition-colors hover:border-violet-400 hover:text-violet-700 dark:hover:border-violet-500 dark:hover:text-violet-300 ${
        node.scheduled_date === todayString
          ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/20 dark:text-violet-300"
          : "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
      }`}
    >
      {formatScheduleDate(node.scheduled_date, todayString)}
    </button>
  );
}

"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { DailyTimeline } from "@papesce/dayslot";
import type { TimelineEvent } from "@papesce/dayslot";
import "@papesce/dayslot/style.css";
import { Idea, LifeArea, getAreasForIdea, Tag } from "@/lib/types";
import { AREA_LABELS } from "./constants";
import {
  minutesToTimeString,
  parseTimeToMinutes,
} from "./dayslotAdapter";
import { TagPicker } from "@/components/shared/TagPicker";

interface DayslotTimelineProps {
  activeDate: string;
  allTasks: Idea[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => void;
  onCreateTask: (text: string, time: string, area?: LifeArea) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
  tags: Tag[];
  selectedArea: LifeArea | null;
  onChangeTaskArea?: (taskId: string, fromArea: LifeArea, toArea: LifeArea) => void;
  onAddTag?: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag?: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
}

const AREA_ACCENT_COLORS: Record<LifeArea, string> = {
  work: "#3b82f6",
  health: "#ef4444",
  relationships: "#ec4899",
  growth: "#f59e0b",
  finances: "#10b981",
  life: "#8b5cf6",
};

const AREA_BG_CLASSES: Record<LifeArea, string> = {
  work: "bg-blue-50/65 border-blue-200/40 dark:bg-blue-950/15 dark:border-blue-900/25 text-blue-700 dark:text-blue-300",
  health: "bg-red-50/65 border-red-200/40 dark:bg-red-950/15 dark:border-red-900/25 text-red-700 dark:text-red-300",
  relationships: "bg-pink-50/65 border-pink-200/40 dark:bg-pink-950/15 dark:border-pink-900/25 text-pink-700 dark:text-pink-300",
  growth: "bg-amber-50/65 border-amber-200/40 dark:bg-amber-950/15 dark:border-amber-900/25 text-amber-700 dark:text-amber-300",
  finances: "bg-emerald-50/65 border-emerald-200/40 dark:bg-emerald-950/15 dark:border-emerald-900/25 text-emerald-700 dark:text-emerald-300",
  life: "bg-violet-50/65 border-violet-200/40 dark:bg-violet-950/15 dark:border-violet-900/25 text-violet-700 dark:text-violet-300",
};

function getCategoryColor(areas: LifeArea[]): string | undefined {
  const area = areas[0];
  return area ? AREA_ACCENT_COLORS[area] : undefined;
}

function getCategoryLabel(areas: LifeArea[]): string | undefined {
  const area = areas[0];
  return area ? AREA_LABELS[area] : undefined;
}

function SlotForm({
  startMinute,
  close,
  onCreateTask,
  defaultArea,
  tags,
  onAddTag,
  onCreateTag,
}: {
  startMinute: number;
  close: () => void;
  onCreateTask: (text: string, time: string, area?: LifeArea) => Promise<void>;
  defaultArea: LifeArea | null;
  tags: Tag[];
  onAddTag?: (ideaId: string, tag: Tag) => Promise<void>;
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
}) {
  const [text, setText] = useState("");
  const [selectedArea, setSelectedArea] = useState<LifeArea | null>(defaultArea);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const areaBtnRef = useRef<HTMLButtonElement>(null);
  const [areaPickerPos, setAreaPickerPos] = useState<{ top: number; left: number } | null>(null);

  const timeStr = minutesToTimeString(startMinute);

  const systemTags = useMemo(() => tags.filter((t) => t.is_system), [tags]);
  const areaSystemTag = useMemo(
    () => systemTags.find((t) => t.area === (selectedArea || "life")),
    [systemTags, selectedArea],
  );

  const handleAdd = async () => {
    if (!text.trim()) return;
    const id = await onCreateTask(text.trim(), timeStr, selectedArea ?? undefined);
    close();
  };

  return (
    <div className="w-full flex flex-col gap-1.5 bg-black/[0.02] dark:bg-white/[0.02] p-2 rounded-xl border border-black/5 dark:border-white/5">
      <input
        type="text"
        placeholder={`Add task at ${timeStr}...`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) void handleAdd();
          if (e.key === "Escape") close();
        }}
        className="w-full bg-white/80 dark:bg-gray-800/80 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 text-gray-800 dark:text-gray-200"
        autoFocus
      />
      <div className="flex items-center justify-between gap-2">
        <button
          ref={areaBtnRef}
          onClick={() => {
            if (showAreaPicker) { setShowAreaPicker(false); return; }
            const rect = areaBtnRef.current?.getBoundingClientRect();
            if (rect) setAreaPickerPos({ top: rect.bottom + 4, left: rect.left });
            setShowAreaPicker(true);
          }}
          className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
        >
          Area: {selectedArea ? AREA_LABELS[selectedArea] : "Life"}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={close}
            className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleAdd()}
            className="text-[10px] bg-violet-600 text-white px-2.5 py-1 rounded-lg hover:bg-violet-700 font-bold cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>
      {showAreaPicker && areaPickerPos && createPortal(
        <div style={{ position: "fixed", top: areaPickerPos.top, left: areaPickerPos.left, zIndex: 10000 }}>
          <TagPicker
            allTags={tags}
            selectedTags={areaSystemTag ? [areaSystemTag] : []}
            onAdd={(tag) => {
              setSelectedArea(tag.area);
              setShowAreaPicker(false);
            }}
            onRemove={() => {}}
            onCreateTag={onCreateTag ?? (async () => null)}
            onClose={() => setShowAreaPicker(false)}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

function taskToEvent(idea: Idea, tags: Tag[]): TimelineEvent {
  const areas = getAreasForIdea(tags);
  const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);

  return {
    id: idea.id,
    title: idea.text,
    startMinute: idea.scheduled_time
      ? parseTimeToMinutes(idea.scheduled_time)
      : 480,
    durationMinutes: idea.duration_minutes ?? 30,
    color: getCategoryColor(effectiveAreas),
    category: getCategoryLabel(effectiveAreas),
  };
}

export function DayslotTimeline({
  activeDate,
  allTasks,
  onUpdateTask,
  onCreateTask,
  getTagsForIdea,
  tags,
  selectedArea,
  onChangeTaskArea,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: DayslotTimelineProps) {
  const isToday = activeDate === new Date().toISOString().slice(0, 10);
  const scheduledTasks = useMemo(
    () => allTasks.filter((t) => t.scheduled_time && t.status !== "archived"),
    [allTasks],
  );

  const events = useMemo(
    () => scheduledTasks.map((t) => taskToEvent(t, getTagsForIdea(t.id))),
    [scheduledTasks, getTagsForIdea],
  );

  const handleEventChange = useCallback(
    (event: TimelineEvent) => {
      onUpdateTask(event.id, {
        scheduled_time: minutesToTimeString(event.startMinute),
        duration_minutes: event.durationMinutes,
      });
    },
    [onUpdateTask],
  );

  const handleExternalDrop = useCallback(
    (taskId: string, startMinute: number) => {
      onUpdateTask(taskId, {
        scheduled_time: minutesToTimeString(startMinute),
        status: "scheduled",
      });
    },
    [onUpdateTask],
  );

  const handleEventRemove = useCallback(
    (event: TimelineEvent) => {
      onUpdateTask(event.id, { scheduled_time: null });
    },
    [onUpdateTask],
  );

  const renderSlotAction = useCallback(
    (startMinute: number, close: () => void) => {
      return (
        <SlotForm
          startMinute={startMinute}
          close={close}
          onCreateTask={onCreateTask}
          defaultArea={selectedArea}
          tags={tags}
          onAddTag={onAddTag}
          onCreateTag={onCreateTag}
        />
      );
    },
    [onCreateTask, selectedArea, tags, onAddTag, onCreateTag],
  );

  const renderEventContent = useCallback(
    (event: TimelineEvent) => {
      const idea = scheduledTasks.find((t) => t.id === event.id);
      if (!idea) return null;
      const isCompleted = idea.status === "completed";
      const isCancelled = idea.status === "cancelled";

      const tagsForIdea = getTagsForIdea(idea.id);
      const areas = getAreasForIdea(tagsForIdea);
      const area = areas[0] || "life";
      const bgClass = AREA_BG_CLASSES[area] || AREA_BG_CLASSES.life;
      const accentColor = AREA_ACCENT_COLORS[area] || AREA_ACCENT_COLORS.life;

      return (
        <EventCard
          idea={idea}
          event={event}
          area={area}
          areaTags={tagsForIdea}
          allTags={tags}
          bgClass={bgClass}
          accentColor={accentColor}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
          onChangeTaskArea={onChangeTaskArea}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onCreateTag={onCreateTag}
        />
      );
    },
    [scheduledTasks, getTagsForIdea, tags, onChangeTaskArea, onAddTag, onRemoveTag, onCreateTag],
  );

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-black/5 dark:border-white/5">
      <DailyTimeline
        events={events}
        startHour={7}
        endHour={22}
        hourHeight={128}
        snapMinutes={15}
        height="1100px"
        title="Daily Timeline"
        onEventChange={handleEventChange}
        onExternalDrop={handleExternalDrop}
        onEventRemove={handleEventRemove}
        externalDragDuration={30}
        renderEventContent={renderEventContent}
        renderSlotAction={renderSlotAction}
        showCurrentTime={isToday}
        slotActionTrigger="button"
        slotIntervalMinutes={30}
      />
    </div>
  );
}

function EventCard({
  idea,
  event,
  area,
  areaTags,
  allTags,
  bgClass,
  accentColor,
  isCompleted,
  isCancelled,
  onChangeTaskArea,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: {
  idea: Idea;
  event: TimelineEvent;
  area: LifeArea;
  areaTags: Tag[];
  allTags: Tag[];
  bgClass: string;
  accentColor: string;
  isCompleted: boolean;
  isCancelled: boolean;
  onChangeTaskArea?: (taskId: string, fromArea: LifeArea, toArea: LifeArea) => void;
  onAddTag?: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag?: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const areaBtnRef = useRef<HTMLButtonElement>(null);
  const [areaPickerPos, setAreaPickerPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowAreaPicker(false);
      }
    };
    if (showMenu || showAreaPicker) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu, showAreaPicker]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ top: e.clientY, left: e.clientX });
    setShowMenu(true);
  }, []);

  const handleOpenAreaPicker = useCallback(() => {
    if (showAreaPicker) { setShowAreaPicker(false); return; }
    const rect = areaBtnRef.current?.getBoundingClientRect();
    if (rect) setAreaPickerPos({ top: rect.bottom + 4, left: rect.left });
    setShowAreaPicker(true);
  }, [showAreaPicker]);

  const handleTagSelected = useCallback(async (tag: Tag) => {
    if (tag.area === area) return;
    const currentAreaTag = areaTags.find((t) => t.is_system);
    if (currentAreaTag && onRemoveTag) {
      await onRemoveTag(idea.id, currentAreaTag.id);
    }
    if (onAddTag) {
      await onAddTag(idea.id, tag);
    }
    setShowMenu(false);
    setShowAreaPicker(false);
  }, [area, areaTags, idea.id, onAddTag, onRemoveTag]);

  const currentSystemTag = areaTags.find((t) => t.is_system);

  return (
    <div
      className={`flex h-full w-full rounded-[9px] border backdrop-blur-md transition-all duration-200 ${bgClass}`}
      onContextMenu={handleContextMenu}
    >
      <div
        className="w-1 flex-shrink-0 rounded-l-full my-1.5 ml-1.5"
        style={{ background: accentColor }}
      />
      <div className="flex-1 flex flex-col justify-between min-w-0 px-2 py-1.5">
        <span
          className={`text-[10px] font-bold leading-tight break-words ${
            isCompleted
              ? "line-through opacity-50"
              : isCancelled
                ? "opacity-50"
                : ""
          }`}
        >
          {event.title}
        </span>
        <div className="flex items-center justify-between mt-auto pt-1">
          <button
            ref={areaBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenAreaPicker();
            }}
            className="text-[8px] font-bold opacity-60 hover:opacity-100 flex items-center gap-1 cursor-pointer"
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: accentColor }}
            />
            {event.category}
          </button>
          {event.durationMinutes > 0 && (
            <span className="text-[8px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded font-bold tabular-nums">
              {event.durationMinutes}m
            </span>
          )}
        </div>
      </div>

      {showMenu && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="glass-card-strong rounded-lg py-1 min-w-[160px] shadow-lg border border-black/5 dark:border-white/5"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenAreaPicker();
            }}
            className="flex w-full text-left px-3 py-1.5 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] font-semibold cursor-pointer"
          >
            Change Area...
          </button>
        </div>,
        document.body
      )}

      {showAreaPicker && areaPickerPos && createPortal(
        <div style={{ position: "fixed", top: areaPickerPos.top, left: areaPickerPos.left, zIndex: 10000 }}>
          <TagPicker
            allTags={allTags}
            selectedTags={currentSystemTag ? [currentSystemTag] : []}
            onAdd={handleTagSelected}
            onRemove={() => {}}
            onCreateTag={onCreateTag ?? (async () => null)}
            onClose={() => { setShowAreaPicker(false); setShowMenu(false); }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

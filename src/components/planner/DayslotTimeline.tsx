"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { DailyTimeline } from "@papesce/dayslot";
import type { TimelineEvent, DailyTimelineHandle } from "@papesce/dayslot";
import "@papesce/dayslot/style.css";
import {
  Idea,
  IdeaStatus,
  LifeArea,
  getAreasForIdea,
  getPrimaryTagForIdea,
  Tag,
} from "@/lib/types";
import { AREA_LABELS, STATUS_CONFIG } from "@/lib/constants";
import { minutesToTimeString, parseTimeToMinutes } from "./dayslotAdapter";
import { TagPicker } from "@/components/shared/TagPicker";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

interface DayslotTimelineProps {
  activeDate: string;
  allTasks: Idea[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => void;
  onCreateTask: (text: string, time: string, area?: LifeArea, tag?: Tag) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
  tags: Tag[];
  selectedArea: LifeArea | null;
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
  health:
    "bg-red-50/65 border-red-200/40 dark:bg-red-950/15 dark:border-red-900/25 text-red-700 dark:text-red-300",
  relationships:
    "bg-pink-50/65 border-pink-200/40 dark:bg-pink-950/15 dark:border-pink-900/25 text-pink-700 dark:text-pink-300",
  growth:
    "bg-amber-50/65 border-amber-200/40 dark:bg-amber-950/15 dark:border-amber-900/25 text-amber-700 dark:text-amber-300",
  finances:
    "bg-emerald-50/65 border-emerald-200/40 dark:bg-emerald-950/15 dark:border-emerald-900/25 text-emerald-700 dark:text-emerald-300",
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
  onCreateTag,
}: {
  startMinute: number;
  close: () => void;
  onCreateTask: (text: string, time: string, area?: LifeArea, tag?: Tag) => Promise<void>;
  defaultArea: LifeArea | null;
  tags: Tag[];
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
}) {
  const [text, setText] = useState("");
  const [selectedArea, setSelectedArea] = useState<LifeArea | null>(defaultArea);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const areaBtnRef = useRef<HTMLButtonElement>(null);
  const [areaPickerPos, setAreaPickerPos] = useState<{ top: number; left: number } | null>(null);
  const submittingRef = useRef(false);

  const timeStr = minutesToTimeString(startMinute);

  const systemTags = useMemo(() => tags.filter((t) => t.is_system), [tags]);
  const areaSystemTag = useMemo(
    () => systemTags.find((t) => t.area === (selectedArea || "life")),
    [systemTags, selectedArea],
  );

  const handleAdd = async () => {
    if (!text.trim() || submittingRef.current) return;
    submittingRef.current = true;
    close();
    try {
      await onCreateTask(text.trim(), timeStr, selectedArea ?? undefined, selectedTag ?? undefined);
    } catch (err) {
      console.error("Failed to create scheduled task", err);
    }
  };

  return (
    <div className="flex w-full flex-col gap-1.5 rounded-xl border border-black/5 bg-black/[0.02] p-2 dark:border-white/5 dark:bg-white/[0.02]">
      <input
        type="text"
        placeholder={`Add task at ${timeStr}...`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) void handleAdd();
          if (e.key === "Escape") close();
        }}
        className="w-full rounded-lg border border-black/10 bg-white/80 px-2 py-1 text-xs text-gray-800 focus:ring-1 focus:ring-violet-500 focus:outline-none dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-200"
        autoFocus
      />
      <div className="flex items-center justify-between gap-2">
        <button
          ref={areaBtnRef}
          onClick={() => {
            if (showAreaPicker) {
              setShowAreaPicker(false);
              return;
            }
            const rect = areaBtnRef.current?.getBoundingClientRect();
            if (rect) setAreaPickerPos({ top: rect.bottom + 4, left: rect.left });
            setShowAreaPicker(true);
          }}
          className="cursor-pointer rounded-full border border-black/10 px-2 py-0.5 text-[10px] font-bold text-gray-600 hover:bg-black/5 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
        >
          Area: {selectedArea ? AREA_LABELS[selectedArea] : "Life"}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={close}
            className="cursor-pointer px-2 py-1 text-[10px] text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleAdd()}
            className="cursor-pointer rounded-lg bg-violet-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-violet-700"
          >
            Add
          </button>
        </div>
      </div>
      {showAreaPicker &&
        areaPickerPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: areaPickerPos.top,
              left: areaPickerPos.left,
              zIndex: 10000,
            }}
          >
            <TagPicker
              allTags={tags}
              selectedTags={areaSystemTag ? [areaSystemTag] : []}
              onAdd={(tag) => {
                setSelectedArea(tag.area);
                setSelectedTag(tag);
                setShowAreaPicker(false);
              }}
              onRemove={() => {}}
              onCreateTag={onCreateTag ?? (async () => null)}
              onClose={() => setShowAreaPicker(false)}
              singleSelect
            />
          </div>,
          document.body,
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
    startMinute: idea.scheduled_time ? parseTimeToMinutes(idea.scheduled_time) : 480,
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
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: DayslotTimelineProps) {
  const isToday = activeDate === new Date().toISOString().slice(0, 10);
  const isMobile = useIsMobile();
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  const handleTimelineRef = useCallback((handle: DailyTimelineHandle | null) => {
    setScrollEl(handle?.scrollElement ?? null);
  }, []);
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
          onCreateTag={onCreateTag}
        />
      );
    },
    [onCreateTask, selectedArea, tags, onCreateTag],
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
          areaTags={tagsForIdea}
          allTags={tags}
          bgClass={bgClass}
          accentColor={accentColor}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
          scrollElement={scrollEl}
          onUpdateTask={onUpdateTask}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onCreateTag={onCreateTag}
        />
      );
    },
    [
      scheduledTasks,
      getTagsForIdea,
      tags,
      scrollEl,
      onUpdateTask,
      onAddTag,
      onRemoveTag,
      onCreateTag,
    ],
  );

  return (
    <div className="glass-card overflow-hidden rounded-2xl border border-black/5 dark:border-white/5">
      <DailyTimeline
        events={events}
        startHour={7}
        endHour={22}
        hourHeight={isMobile ? 80 : 128}
        snapMinutes={15}
        height={isMobile ? "auto" : "1100px"}
        title="Daily Timeline"
        timelineRef={handleTimelineRef}
        onEventChange={handleEventChange}
        onExternalDrop={handleExternalDrop}
        onEventRemove={handleEventRemove}
        externalDragDuration={30}
        renderEventContent={renderEventContent}
        renderSlotAction={renderSlotAction}
        showCurrentTime={isToday}
        slotActionTrigger="button"
        slotMinutes={15}
        customProperties={{ "--ds-event-padding": "0" }}
      />
    </div>
  );
}

function EventCard({
  idea,
  event,
  areaTags,
  allTags,
  bgClass,
  accentColor,
  isCompleted,
  isCancelled,
  scrollElement,
  onUpdateTask,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: {
  idea: Idea;
  event: TimelineEvent;
  areaTags: Tag[];
  allTags: Tag[];
  bgClass: string;
  accentColor: string;
  isCompleted: boolean;
  isCancelled: boolean;
  scrollElement: HTMLDivElement | null;
  onUpdateTask: (id: string, updates: Partial<Idea>) => void;
  onAddTag?: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag?: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const showMenuRef = useRef(false);
  const showAreaPickerRef = useRef(false);
  const showStatusPickerRef = useRef(false);

  useEffect(() => {
    showMenuRef.current = showMenu;
  }, [showMenu]);
  useEffect(() => {
    showAreaPickerRef.current = showAreaPicker;
  }, [showAreaPicker]);
  useEffect(() => {
    showStatusPickerRef.current = showStatusPicker;
  }, [showStatusPicker]);
  const [statusPickerPos, setStatusPickerPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const areaBtnRef = useRef<HTMLButtonElement>(null);
  const [areaPickerPos, setAreaPickerPos] = useState<{ top: number; left: number } | null>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowAreaPicker(false);
      }
    };
    if (showMenu || showAreaPicker) {
      document.addEventListener("pointerdown", handler);
    }
    return () => document.removeEventListener("pointerdown", handler);
  }, [showMenu, showAreaPicker]);

  useEffect(() => {
    if (!scrollElement) return;
    const handler = () => {
      if (showStatusPickerRef.current) {
        const rect = statusBtnRef.current?.getBoundingClientRect();
        if (rect) setStatusPickerPos({ top: rect.bottom + 4, left: rect.left });
      }
      if (showAreaPickerRef.current) {
        const rect = areaBtnRef.current?.getBoundingClientRect();
        if (rect) setAreaPickerPos({ top: rect.bottom + 4, left: rect.left });
      }
      if (showMenuRef.current) {
        setShowMenu(false);
      }
    };
    scrollElement.addEventListener("scroll", handler, { passive: true });
    return () => scrollElement.removeEventListener("scroll", handler);
  }, [scrollElement]);

  const handleStatusSelect = useCallback(
    (status: IdeaStatus) => {
      const now = new Date().toISOString();
      switch (status) {
        case "completed":
          onUpdateTask(idea.id, { status: "completed", completed_at: now });
          break;
        case "cancelled":
          onUpdateTask(idea.id, { status: "cancelled", cancelled_at: now });
          break;
        case "in_progress":
          onUpdateTask(idea.id, { status: "in_progress" });
          break;
        case "paused":
          onUpdateTask(idea.id, { status: "paused", paused_at: now });
          break;
        case "planned":
        case "scheduled":
        case "draft":
        case "inbox":
        case "deferred":
          onUpdateTask(idea.id, {
            status,
            completed_at: null,
            cancelled_at: null,
            paused_at: null,
          });
          break;
      }
      setShowStatusPicker(false);
    },
    [idea.id, onUpdateTask],
  );

  const handleOpenStatusPicker = useCallback(() => {
    if (showStatusPicker) {
      setShowStatusPicker(false);
      return;
    }
    const rect = statusBtnRef.current?.getBoundingClientRect();
    if (rect) setStatusPickerPos({ top: rect.bottom + 4, left: rect.left });
    setShowStatusPicker(true);
  }, [showStatusPicker]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ top: e.clientY, left: e.clientX });
    setShowMenu(true);
  }, []);

  const handleOpenAreaPicker = useCallback(() => {
    if (showAreaPicker) {
      setShowAreaPicker(false);
      return;
    }
    const rect = areaBtnRef.current?.getBoundingClientRect();
    if (rect) setAreaPickerPos({ top: rect.bottom + 4, left: rect.left });
    setShowAreaPicker(true);
  }, [showAreaPicker]);

  const handleExclusiveTagSelected = useCallback(
    async (tag: Tag) => {
      for (const existing of areaTags) {
        if (existing.id !== tag.id && onRemoveTag) {
          await onRemoveTag(idea.id, existing.id);
        }
      }
      if (onAddTag) {
        await onAddTag(idea.id, tag);
      }
      setShowMenu(false);
      setShowAreaPicker(false);
    },
    [idea.id, areaTags, onAddTag, onRemoveTag],
  );

  const primaryTag = getPrimaryTagForIdea(areaTags);

  return (
    <div
      className={`flex h-full w-full rounded-[9px] border backdrop-blur-md transition-all duration-200 ${bgClass}`}
      style={{ containerType: "inline-size" }}
      onContextMenu={handleContextMenu}
    >
      <div
        className="my-1.5 ml-1.5 w-1 flex-shrink-0 rounded-l-full"
        style={{ background: accentColor }}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between px-2 py-1.5">
        <span
          className={`text-[10px] leading-tight font-bold break-words ${
            isCompleted ? "line-through opacity-50" : isCancelled ? "opacity-50" : ""
          }`}
        >
          {event.title}
        </span>
        <div className="mt-auto flex items-center justify-between pt-1 pb-2">
          <button
            ref={areaBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenAreaPicker();
            }}
            className="flex cursor-pointer items-center gap-1 text-[9px] font-bold opacity-60 hover:opacity-100"
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: accentColor }}
            />
            {primaryTag?.name ?? event.category}
          </button>
          {(() => {
            const statusCfg = STATUS_CONFIG[idea.status] || STATUS_CONFIG.planned;
            return (
              <button
                ref={statusBtnRef}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenStatusPicker();
                }}
                className="event-status-badge cursor-pointer rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-all hover:brightness-95"
                style={{ color: statusCfg.hex, background: statusCfg.bg }}
              >
                {statusCfg.label}
              </button>
            );
          })()}
          {event.durationMinutes > 0 && (
            <span className="rounded bg-black/5 px-1.5 py-0.5 text-[9px] font-bold tabular-nums dark:bg-white/10">
              {event.durationMinutes}m
            </span>
          )}
        </div>
      </div>

      {showMenu &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
            className="glass-card-strong min-w-[160px] rounded-lg border border-black/5 py-1 shadow-lg dark:border-white/5"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenStatusPicker();
              }}
              className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              Change Status...
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenAreaPicker();
              }}
              className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              Change Area...
            </button>
            <div className="my-1 border-t border-black/5 dark:border-white/5" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateTask(idea.id, { scheduled_time: null });
                setShowMenu(false);
              }}
              className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20"
            >
              Remove from Timeline
            </button>
          </div>,
          document.body,
        )}

      {showAreaPicker &&
        areaPickerPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: areaPickerPos.top,
              left: areaPickerPos.left,
              zIndex: 10000,
            }}
          >
            <TagPicker
              allTags={allTags}
              selectedTags={areaTags}
              onAdd={handleExclusiveTagSelected}
              onRemove={async (tagId) => {
                if (onRemoveTag) await onRemoveTag(idea.id, tagId);
                setShowAreaPicker(false);
                setShowMenu(false);
              }}
              onCreateTag={onCreateTag ?? (async () => null)}
              onClose={() => {
                setShowAreaPicker(false);
                setShowMenu(false);
              }}
              singleSelect
            />
          </div>,
          document.body,
        )}

      {showStatusPicker &&
        statusPickerPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: statusPickerPos.top,
              left: statusPickerPos.left,
              zIndex: 10000,
            }}
          >
            <StatusPicker
              current={idea.status}
              onSelect={handleStatusSelect}
              onClose={() => {
                setShowStatusPicker(false);
                setShowMenu(false);
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

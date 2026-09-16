"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { TimelineEvent } from "@papesce/dayslot";
import { Idea, IdeaStatus, LifeArea, getPrimaryTagForIdea, Tag } from "@/lib/types";
import { STATUS_CONFIG, PRODUCTIVITY_SIGNALS } from "@/lib/constants";
import { TagPicker } from "@/components/shared/TagPicker";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";
import { computeStatusUpdates } from "@/lib/tasks/statusTransition";

export function EventCard({
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
  const signalCfg =
    idea.productivity_signal &&
    PRODUCTIVITY_SIGNALS[idea.productivity_signal as keyof typeof PRODUCTIVITY_SIGNALS];
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
      onUpdateTask(idea.id, computeStatusUpdates(status));
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
      style={{
        containerType: "inline-size",
        background: signalCfg ? signalCfg.bg : undefined,
        borderLeft: signalCfg ? `3px solid ${signalCfg.color}` : undefined,
        borderBottom: signalCfg ? `3px solid ${signalCfg.color}` : undefined,
      }}
      onContextMenu={handleContextMenu}
      aria-label={signalCfg ? `Productivity: ${signalCfg.label}` : undefined}
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
          {signalCfg && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
              style={{ color: signalCfg.color, background: signalCfg.pillBg }}
            >
              {signalCfg.icon}
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
              className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              Clear time
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

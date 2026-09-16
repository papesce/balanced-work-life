"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useDragControls } from "framer-motion";
import { Star, MoreHorizontal, Link2, GripVertical } from "lucide-react";
import { Idea, IdeaStatus, IdeaLink, LinkType, Tag, LifeArea } from "@/lib/types";
import { TagPicker } from "@/components/shared/TagPicker";
import { AREA_DOT_COLORS, STATUS_CONFIG } from "@/lib/constants";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";
import { SchedulePicker } from "@/components/brainstorm/SchedulePicker";
import { MoveIdeaPanel } from "@/components/brainstorm/MoveIdeaPanel";
import { LinkPanel } from "@/components/brainstorm/LinkPanel";
import { RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { RevealInMenu } from "@/components/shared/RevealInMenu";
import { NotesIndicator } from "@/components/shared/NotesIndicator";
import { useNotes } from "@/contexts/NotesContext";
import { Eye } from "lucide-react";
import { applyStatusTransition } from "@/lib/tasks/statusTransition";
import { useRouter } from "next/navigation";
import { getRevealHref } from "@/lib/reveal";

interface TimelineTaskRowProps {
  task: Idea;
  occurrenceDate?: string;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onMove?: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  ideas?: Idea[];
  links?: IdeaLink[];
  onCreateLink?: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink?: (id: string) => Promise<void>;
  today: string;
  dragControls: ReturnType<typeof useDragControls>;
  allTags: Tag[];
  taskTags: Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  isHistorical?: boolean;
  onGoToDate?: (date: string, taskId: string) => void;
}

export function TimelineTaskRow({
  task,
  occurrenceDate,
  onDone,
  onUndone,
  onUpdate,
  onReschedule,
  onMove,
  ideas,
  links,
  onCreateLink,
  onDeleteLink,
  today,
  dragControls,
  allTags,
  taskTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  isHistorical = false,
  onGoToDate,
}: TimelineTaskRowProps) {
  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";
  const isInProgress = task.status === "in_progress";
  const isPaused = task.status === "paused";
  const isReschedule =
    isHistorical ||
    task.status === "deferred" ||
    (task.scheduled_date !== null && task.scheduled_date < today);
  const dateActionLabel = isReschedule ? "Reschedule" : "Move";
  const statusConfig = STATUS_CONFIG[task.status];
  const attemptTarget = task.scheduled_date ?? task.attempt_dates[task.attempt_dates.length - 1];
  const attemptLabel = task.scheduled_date ? "Go to next attempt" : "Go to last attempt";
  const [showMenu, setShowMenu] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [revealPos, setRevealPos] = useState<{ top: number; right: number } | null>(null);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);
  const [statusPickerPos, setStatusPickerPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const tagTriggerRef = useRef<HTMLButtonElement>(null);
  const [tagPickerPos, setTagPickerPos] = useState<{ top: number; left: number } | null>(null);
  const { openNotes } = useNotes();
  const router = useRouter();
  const linkBadgeRef = useRef<HTMLButtonElement>(null);
  const [linkPanelPos, setLinkPanelPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuTriggerRef.current &&
        !menuTriggerRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  useEffect(() => {
    if (!showMenu) return;
    const close = () => {
      setShowMenu(false);
      setShowDatePicker(false);
      setShowAttachPanel(false);
      setShowLinkPanel(false);
    };
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [showMenu]);

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!showStatusPicker) return;
    const close = () => setShowStatusPicker(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [showStatusPicker]);

  const handleStatusSelect = (status: IdeaStatus) => {
    applyStatusTransition(task.id, status, onUpdate, { onDone, onUndone });
    setShowStatusPicker(false);
  };

  const handleStartEdit = () => {
    setEditText(task.text);
    setIsEditing(true);
  };

  const handleConfirmEdit = () => {
    if (editText.trim() && editText.trim() !== task.text) {
      onUpdate(task.id, { text: editText.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  useEffect(() => {
    if (!showLinkPanel || showMenu) return;
    const close = () => setShowLinkPanel(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    const handler = (e: MouseEvent) => {
      if (linkBadgeRef.current && !linkBadgeRef.current.contains(e.target as Node)) {
        const linkPanelEl = document.querySelector("[data-link-panel-portal]");
        if (linkPanelEl && linkPanelEl.contains(e.target as Node)) return;
      }
    };
    document.addEventListener("mousedown", handler);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
      document.removeEventListener("mousedown", handler);
    };
  }, [showLinkPanel, showMenu]);

  return (
    <div
      id={occurrenceDate ? `task-${task.id}-${occurrenceDate}` : undefined}
      className={`group flex items-center gap-1.5 rounded-xl px-3 py-2 transition-colors ${isHovered ? "bg-black/[0.03] dark:bg-white/[0.04]" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        setRevealPos({ top: e.clientY + 4, right: window.innerWidth - e.clientX - 4 });
        setShowReveal(true);
      }}
    >
      <button
        onPointerDown={(e) => dragControls.start(e)}
        className="flex-shrink-0 cursor-grab text-gray-300 opacity-0 transition-colors group-hover:opacity-100 hover:text-gray-400 active:cursor-grabbing dark:text-gray-600"
        aria-label="Drag to reorder"
      >
        <GripVertical size={12} />
      </button>

      {statusConfig.icon && (
        <statusConfig.icon
          size={12}
          strokeWidth={2}
          className={`flex-shrink-0 ${statusConfig.textClass}`}
        />
      )}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleConfirmEdit}
          className="min-w-0 flex-1 rounded-lg border border-violet-300 bg-white/80 px-1.5 py-0.5 text-sm outline-none focus:border-violet-500 dark:border-violet-600 dark:bg-gray-800/80"
        />
      ) : (
        <span
          onClick={handleStartEdit}
          className={`-mx-1 flex-1 cursor-text truncate rounded px-1 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${isCancelled ? "text-red-400/60" : ""}`}
          style={{
            fontWeight: 450,
            color: isCompleted
              ? "rgba(107, 114, 128, 0.6)"
              : isCancelled
                ? "rgba(239, 68, 68, 0.5)"
                : isPaused
                  ? "rgba(249, 115, 22, 0.7)"
                  : "var(--text-primary)",
          }}
        >
          {task.text}
        </span>
      )}

      {task.scheduled_time && (
        <span className="flex-shrink-0 text-[10px] font-semibold text-violet-600 tabular-nums dark:text-violet-400">
          {task.scheduled_time.slice(0, 5)}
        </span>
      )}

      {(() => {
        const parent = ideas?.find((i) => i.id === task.parent_id);
        if (!parent) return null;
        const isProject = parent.type === "project";
        const href = isProject
          ? getRevealHref("projects", parent, ideas)
          : getRevealHref("brainstorm", parent, ideas);
        return (
          <button
            title={`Reveal parent: ${parent.text || "Untitled"}`}
            aria-label={`Reveal parent ${parent.text || "Untitled"}`}
            onClick={(e) => {
              e.stopPropagation();
              router.push(href);
            }}
            className="max-w-[100px] cursor-pointer truncate rounded-full bg-black/[0.04] px-2 py-0.5 text-[9px] font-semibold text-gray-500 transition-colors hover:bg-black/[0.08] hover:text-gray-700 dark:bg-white/[0.06] dark:text-gray-400 dark:hover:bg-white/[0.10] dark:hover:text-gray-200"
          >
            in: {parent.text || "Untitled"}
          </button>
        );
      })()}
      {(() => {
        const count =
          links?.filter((l) => l.source_id === task.id || l.target_id === task.id).length ?? 0;
        if (count === 0) return null;
        return (
          <button
            ref={linkBadgeRef}
            aria-label={`View links (${count})`}
            title="View links"
            onClick={(e) => {
              e.stopPropagation();
              if (showLinkPanel) {
                setShowLinkPanel(false);
                return;
              }
              const rect = linkBadgeRef.current?.getBoundingClientRect();
              if (rect) setLinkPanelPos({ top: rect.bottom + 4, left: rect.left });
              setShowMenu(false);
              setShowDatePicker(false);
              setShowAttachPanel(false);
              setShowLinkPanel(true);
            }}
            className="flex cursor-pointer items-center gap-0.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
          >
            <Link2 size={10} /> {count}
          </button>
        );
      })()}

      <div className="relative flex flex-shrink-0 items-center gap-1">
        {taskTags.map((tag) => (
          <span
            key={tag.id}
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
            style={{ opacity: 0.85 }}
          >
            <span
              className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${AREA_DOT_COLORS[tag.area]}`}
            />
            {tag.name}
          </span>
        ))}
        <button
          ref={tagTriggerRef}
          onClick={() => {
            if (showTagPicker) {
              setShowTagPicker(false);
              return;
            }
            const rect = tagTriggerRef.current?.getBoundingClientRect();
            if (rect) setTagPickerPos({ top: rect.bottom + 4, left: rect.left });
            setShowTagPicker(true);
          }}
          className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] font-semibold text-gray-400 hover:bg-black/10 dark:bg-white/5 dark:text-gray-500 dark:hover:bg-white/10"
        >
          {taskTags.length === 0 ? "tag" : "+"}
        </button>
        {showTagPicker && tagPickerPos && (
          <TagPicker
            allTags={allTags}
            selectedTags={taskTags}
            onAdd={(tag) => {
              void onAddTag(task.id, tag);
            }}
            onRemove={(tagId) => {
              void onRemoveTag(task.id, tagId);
            }}
            onCreateTag={onCreateTag}
            onClose={() => setShowTagPicker(false)}
            fixedPosition={tagPickerPos}
          />
        )}
      </div>

      <div className="relative flex-shrink-0">
        <button
          ref={statusTriggerRef}
          onClick={() => {
            if (showStatusPicker) {
              setShowStatusPicker(false);
              return;
            }
            const rect = statusTriggerRef.current?.getBoundingClientRect();
            if (rect) setStatusPickerPos({ top: rect.bottom + 4, left: rect.left });
            setShowStatusPicker(true);
          }}
          className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all hover:opacity-80"
          style={{
            background: isCompleted
              ? "#f5f3ff"
              : isCancelled
                ? "#fef2f2"
                : isPaused
                  ? "#fff7ed"
                  : isInProgress
                    ? "#fefce8"
                    : "rgba(0,0,0,0.05)",
            color: isCompleted
              ? "#7c3aed"
              : isCancelled
                ? "#ef4444"
                : isPaused
                  ? "#f97316"
                  : isInProgress
                    ? "#d97706"
                    : "#9ca3af",
          }}
        >
          {statusConfig.label}
        </button>
        {showStatusPicker &&
          statusPickerPos &&
          createPortal(
            <div
              style={{
                position: "fixed",
                top: statusPickerPos.top,
                left: statusPickerPos.left,
                zIndex: 9999,
              }}
            >
              <StatusPicker
                current={task.status}
                onSelect={handleStatusSelect}
                onClose={() => setShowStatusPicker(false)}
              />
            </div>,
            document.body,
          )}
      </div>

      <NotesIndicator hasNotes={!!task.notes?.trim()} onClick={() => openNotes(task.id)} />
      <button
        onClick={() => onUpdate(task.id, { is_priority: !task.is_priority })}
        className={`flex-shrink-0 transition-colors ${task.is_priority ? "text-amber-400" : "text-gray-200 hover:text-gray-400 dark:text-gray-600"}`}
      >
        <Star size={14} strokeWidth={1.5} className={task.is_priority ? "fill-amber-400" : ""} />
      </button>

      <div className="relative">
        <button
          ref={menuTriggerRef}
          onClick={() => {
            if (showMenu) {
              setShowMenu(false);
              return;
            }
            const rect = menuTriggerRef.current?.getBoundingClientRect();
            if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
            setShowMenu(true);
          }}
          className={`flex-shrink-0 text-gray-300 transition-all hover:text-gray-500 dark:text-gray-600 ${isHovered || showMenu ? "opacity-100" : "opacity-0"}`}
        >
          <MoreHorizontal size={16} strokeWidth={1.5} />
        </button>
        {showMenu &&
          menuPos &&
          createPortal(
            <div
              ref={menuRef}
              style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
              className="glass-card-strong min-w-[160px] rounded-xl py-1.5 shadow-lg"
            >
              {isHistorical && onGoToDate && attemptTarget && (
                <>
                  <button
                    onClick={() => {
                      onGoToDate(attemptTarget, task.id);
                      setShowMenu(false);
                    }}
                    className="flex w-full px-3 py-2 text-left text-xs font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
                  >
                    {attemptLabel}
                  </button>
                  <div className="my-1 border-t border-black/5 dark:border-white/5" />
                </>
              )}
              {task.scheduled_date !== today && (
                <button
                  onClick={() => {
                    void onReschedule(
                      task.id,
                      isReschedule ? { type: "retry_today" } : { type: "move", newDate: today },
                    );
                    setShowMenu(false);
                  }}
                  className="flex w-full px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  {dateActionLabel} to Today
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  {dateActionLabel} Date…{" "}
                  <span className="text-[10px]">{showDatePicker ? "▴" : "▸"}</span>
                </button>
                {showDatePicker && (
                  <SchedulePicker
                    currentDate={task.scheduled_date}
                    onSelect={(date) => {
                      void onReschedule(
                        task.id,
                        isReschedule
                          ? { type: "reschedule", newDate: date }
                          : { type: "move", newDate: date },
                      );
                      setShowDatePicker(false);
                      setShowMenu(false);
                    }}
                    onClear={() => {
                      onUpdate(task.id, { scheduled_date: null });
                      setShowDatePicker(false);
                      setShowMenu(false);
                    }}
                    onClose={() => setShowDatePicker(false)}
                  />
                )}
              </div>

              {onMove && ideas && (
                <div className="relative">
                  <button
                    onClick={() => setShowAttachPanel((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                    title="Keeps deferred occurrence on this day, also shows under selected parent"
                  >
                    Attach to… <span className="text-[10px]">{showAttachPanel ? "▴" : "▸"}</span>
                  </button>
                  {showAttachPanel && (
                    <MoveIdeaPanel
                      idea={task}
                      ideas={ideas}
                      variant="attach"
                      onMove={async (newParentId, newSortOrder) => {
                        await onMove(task.id, newParentId, newSortOrder);
                        setShowAttachPanel(false);
                        setShowMenu(false);
                      }}
                      onMoved={() => {
                        setShowAttachPanel(false);
                        setShowMenu(false);
                      }}
                      onClose={() => setShowAttachPanel(false)}
                    />
                  )}
                </div>
              )}

              {onCreateLink && onDeleteLink && ideas && links && (
                <div className="relative">
                  <button
                    onClick={() => setShowLinkPanel((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                  >
                    Link… <span className="text-[10px]">{showLinkPanel ? "▴" : "▸"}</span>
                  </button>
                  {showLinkPanel && (
                    <LinkPanel
                      ideaId={task.id}
                      ideas={ideas}
                      links={links}
                      onCreateLink={onCreateLink}
                      onDeleteLink={onDeleteLink}
                      onClose={() => setShowLinkPanel(false)}
                    />
                  )}
                </div>
              )}

              <div className="my-1 border-t border-black/5 dark:border-white/5" />
              <button
                onClick={() => {
                  const rect = menuTriggerRef.current?.getBoundingClientRect();
                  if (rect)
                    setRevealPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                  setShowMenu(false);
                  setShowReveal(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                <Eye size={12} strokeWidth={1.5} />
                Reveal in...
              </button>
              <div className="my-1 border-t border-black/5 dark:border-white/5" />
              <button
                onClick={() => {
                  onUpdate(task.id, { status: "archived" });
                  setShowMenu(false);
                }}
                className="flex w-full px-3 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20"
              >
                Archive
              </button>
            </div>,
            document.body,
          )}
        {showReveal && revealPos && (
          <RevealInMenu
            idea={task}
            currentView="timeline"
            position={revealPos}
            onClose={() => setShowReveal(false)}
          />
        )}
        {showLinkPanel &&
          linkPanelPos &&
          !showMenu &&
          onCreateLink &&
          onDeleteLink &&
          ideas &&
          links &&
          createPortal(
            <div
              data-link-panel-portal
              style={{
                position: "fixed",
                top: linkPanelPos.top,
                left: linkPanelPos.left,
                zIndex: 9999,
              }}
            >
              <LinkPanel
                ideaId={task.id}
                ideas={ideas}
                links={links}
                onCreateLink={onCreateLink}
                onDeleteLink={onDeleteLink}
                onClose={() => setShowLinkPanel(false)}
              />
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}

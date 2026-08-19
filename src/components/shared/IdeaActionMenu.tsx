"use client";

import { useState, useRef, useEffect } from "react";
import {
  Link2,
  ArrowUpDown,
  Calendar,
  Trash2,
  MoreHorizontal,
  Pencil,
  Telescope,
  Check,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Idea, IdeaLink, IdeaHorizon, LinkType } from "@/lib/types";
import { LinkPanel } from "@/components/brainstorm/LinkPanel";
import { MoveIdeaPanel } from "@/components/brainstorm/MoveIdeaPanel";
import { SchedulePicker } from "@/components/brainstorm/SchedulePicker";

interface IdeaActionMenuProps {
  idea: Idea;
  allIdeas: Idea[];
  links: IdeaLink[];
  hasChildren: boolean;
  onEdit: () => void;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSchedule: (id: string, date: string | null) => Promise<void>;
  onCreateLink: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onMove: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  onMoved?: (parentIdToExpand: string | null) => void;
  hiddenActions?: Array<"edit" | "link" | "move" | "schedule" | "horizon" | "delete">;
}

export function IdeaActionMenu({
  idea,
  allIdeas,
  links,
  hasChildren,
  onEdit,
  onUpdate,
  onDelete,
  onSchedule,
  onCreateLink,
  onDeleteLink,
  onMove,
  onMoved,
  hiddenActions,
}: IdeaActionMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [showMovePanel, setShowMovePanel] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [showHorizonPicker, setShowHorizonPicker] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hidden = hiddenActions ?? [];

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuTriggerRef.current &&
        !menuTriggerRef.current.contains(target)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const closeAll = () => {
    setShowMenu(false);
    setShowLinkPanel(false);
    setShowMovePanel(false);
    setShowSchedulePicker(false);
    setShowDeleteWarning(false);
    setShowHorizonPicker(false);
  };

  const handleRequestDelete = () => {
    closeAll();
    setShowDeleteWarning(true);
  };

  const handleConfirmDelete = async () => {
    await onDelete(idea.id);
    setShowDeleteWarning(false);
  };

  const handleMove = async (newParentId: string | null, newSortOrder: number) => {
    await onMove(idea.id, newParentId, newSortOrder);
  };

  const handleMoved = (parentIdToExpand: string | null) => {
    if (onMoved) onMoved(parentIdToExpand);
  };

  return (
    <div
      className="relative flex flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
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
        title="Actions"
        className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
          showMenu
            ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        }`}
      >
        <MoreHorizontal size={14} strokeWidth={1.5} />
      </button>
      {showMenu &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
            className="glass-card-strong min-w-[160px] rounded-xl py-1.5 shadow-lg"
          >
            {!hidden.includes("edit") && (
              <>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  <Pencil size={12} strokeWidth={1.5} />
                  Edit
                </button>
                <div className="my-1 border-t border-black/5 dark:border-white/5" />
              </>
            )}
            {!hidden.includes("link") && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowLinkPanel(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                <Link2 size={12} strokeWidth={1.5} />
                Link
              </button>
            )}
            {!hidden.includes("move") && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowMovePanel(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                <ArrowUpDown size={12} strokeWidth={1.5} />
                Move
              </button>
            )}
            {!hidden.includes("schedule") && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowSchedulePicker(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  <Calendar size={12} strokeWidth={1.5} />
                  Schedule
                </button>
              </div>
            )}
            {!hidden.includes("horizon") && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowHorizonPicker(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                <Telescope size={12} strokeWidth={1.5} />
                Horizon
              </button>
            )}
            {!hidden.includes("delete") && (
              <>
                <div className="my-1 border-t border-black/5 dark:border-white/5" />
                <button
                  onClick={handleRequestDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                  Delete
                </button>
              </>
            )}
          </div>,
          document.body,
        )}

      {/* Horizon picker flyout */}
      {showHorizonPicker &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos.top,
              right: menuPos.right + 200,
              zIndex: 9999,
            }}
            className="glass-card-strong min-w-[160px] rounded-xl py-1.5 shadow-lg"
          >
            <p className="px-3 py-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
              Move to horizon
            </p>
            {(["short", "medium", "long"] as IdeaHorizon[]).map((h) => (
              <button
                key={h}
                onClick={() => {
                  onUpdate(idea.id, { horizon: h });
                  setShowHorizonPicker(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                <span className="w-3">
                  {idea.horizon === h && <Check size={12} strokeWidth={2} />}
                </span>
                {h === "short" ? "Short-term" : h === "medium" ? "Medium-term" : "Long-term"}
              </button>
            ))}
            {idea.horizon != null && (
              <>
                <div className="my-1 border-t border-black/5 dark:border-white/5" />
                <button
                  onClick={() => {
                    onUpdate(idea.id, { horizon: null });
                    setShowHorizonPicker(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  <span className="w-3" />
                  Remove from horizon
                </button>
              </>
            )}
          </div>,
          document.body,
        )}

      {/* Sub-panels */}
      {showLinkPanel && (
        <LinkPanel
          ideaId={idea.id}
          ideas={allIdeas}
          links={links}
          onCreateLink={onCreateLink}
          onDeleteLink={onDeleteLink}
          onClose={() => setShowLinkPanel(false)}
        />
      )}
      {showMovePanel && (
        <MoveIdeaPanel
          idea={idea}
          ideas={allIdeas}
          onMove={handleMove}
          onMoved={handleMoved}
          onClose={() => setShowMovePanel(false)}
        />
      )}
      {showSchedulePicker && (
        <div className="relative">
          <SchedulePicker
            currentDate={idea.scheduled_date}
            onSelect={(date) => {
              onSchedule(idea.id, date);
              setShowSchedulePicker(false);
            }}
            onClear={() => {
              onSchedule(idea.id, null);
              setShowSchedulePicker(false);
            }}
            onClose={() => setShowSchedulePicker(false)}
          />
        </div>
      )}
      {showDeleteWarning && (
        <div className="glass-card-strong absolute top-7 right-0 z-20 w-52 rounded-xl border border-red-200 p-2 dark:border-red-500/30">
          <p className="text-xs font-medium text-red-700 dark:text-red-400">Delete this idea?</p>
          {hasChildren && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Child ideas will be deleted too.
            </p>
          )}
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              onClick={() => setShowDeleteWarning(false)}
              className="rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

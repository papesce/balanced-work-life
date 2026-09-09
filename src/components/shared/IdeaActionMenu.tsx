"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Link2,
  ArrowUpDown,
  Calendar,
  Trash2,
  MoreHorizontal,
  Pencil,
  Telescope,
  Check,
  Target,
  Layers,
  Eye,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Idea, IdeaLink, IdeaHorizon, LinkType, Tag, LaneConfig } from "@/lib/types";
import { DEFAULT_UNASSIGNED_LABEL } from "@/lib/constants";
import { LinkPanel } from "@/components/brainstorm/LinkPanel";
import { MoveIdeaPanel } from "@/components/brainstorm/MoveIdeaPanel";
import { SchedulePicker } from "@/components/brainstorm/SchedulePicker";
import { RevealInMenu } from "@/components/shared/RevealInMenu";
import type { RevealView } from "@/lib/reveal";

interface IdeaActionMenuProps {
  idea: Idea;
  allIdeas: Idea[];
  links: IdeaLink[];
  laneConfigs?: LaneConfig[];
  unassignedLabel?: string;
  hasChildren: boolean;
  getTagsForIdea?: (ideaId: string) => Tag[];
  onEdit: () => void;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSchedule: (id: string, date: string | null) => Promise<void>;
  onCreateLink: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onMove: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  onMoved?: (parentIdToExpand: string | null) => void;
  hiddenActions?: Array<"edit" | "link" | "move" | "schedule" | "horizon" | "delete">;
  onToggleInFocus?: (id: string, until?: string | null) => Promise<void>;
  currentView?: RevealView;
}

export function IdeaActionMenu({
  idea,
  allIdeas,
  links,
  laneConfigs,
  unassignedLabel,
  hasChildren,
  getTagsForIdea,
  onEdit,
  onUpdate,
  onDelete,
  onSchedule,
  onCreateLink,
  onDeleteLink,
  onMove,
  onMoved,
  hiddenActions,
  onToggleInFocus,
  currentView,
}: IdeaActionMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [showMovePanel, setShowMovePanel] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [deletePos, setDeletePos] = useState<{ top: number; right: number } | null>(null);
  const [showHorizonPicker, setShowHorizonPicker] = useState(false);
  const [showLanePicker, setShowLanePicker] = useState(false);
  const [showRevealPicker, setShowRevealPicker] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const deleteConfirmRef = useRef<HTMLDivElement>(null);

  const descendantCount = useMemo(() => {
    if (!hasChildren) return 0;
    let count = 0;
    const stack = [idea.id];
    while (stack.length) {
      const current = stack.pop();
      for (const candidate of allIdeas) {
        if (candidate.parent_id === current) {
          count += 1;
          stack.push(candidate.id);
        }
      }
    }
    return count;
  }, [hasChildren, idea.id, allIdeas]);

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

  useEffect(() => {
    if (!showRevealPicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // allow clicks inside any portal menu to propagate; close on outside
      if (!(target instanceof Element && target.closest(".glass-card-strong"))) {
        setShowRevealPicker(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowRevealPicker(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [showRevealPicker]);

  useEffect(() => {
    if (!showDeleteWarning) return;
    const handler = (e: MouseEvent) => {
      if (deleteConfirmRef.current && !deleteConfirmRef.current.contains(e.target as Node)) {
        setShowDeleteWarning(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDeleteWarning(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [showDeleteWarning]);

  const closeAll = () => {
    setShowMenu(false);
    setShowLinkPanel(false);
    setShowMovePanel(false);
    setShowSchedulePicker(false);
    setShowDeleteWarning(false);
    setShowHorizonPicker(false);
    setShowLanePicker(false);
    setShowRevealPicker(false);
  };

  const handleRequestDelete = () => {
    closeAll();
    const rect = menuTriggerRef.current?.getBoundingClientRect();
    if (rect) setDeletePos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
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

  const anyPanelOpen =
    showMenu ||
    showLinkPanel ||
    showMovePanel ||
    showSchedulePicker ||
    showDeleteWarning ||
    showHorizonPicker ||
    showLanePicker ||
    showRevealPicker;

  const laneConfigsForIdea = useMemo(() => {
    if (!idea.horizon || !laneConfigs) return [];
    return laneConfigs.filter((l) => l.horizon === idea.horizon);
  }, [laneConfigs, idea.horizon]);

  const showLaneAction = !!idea.horizon && laneConfigs !== undefined;

  return (
    <div
      className={`relative flex flex-shrink-0 transition-opacity ${
        anyPanelOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}
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
            {showLaneAction && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowLanePicker(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                <Layers size={12} strokeWidth={1.5} />
                Move to lane
              </button>
            )}
            <button
              onClick={() => {
                setShowMenu(false);
                if (onToggleInFocus) void onToggleInFocus(idea.id);
                else
                  void onUpdate(idea.id, {
                    in_focus: !idea.in_focus,
                    in_focus_until: idea.in_focus ? null : idea.in_focus_until,
                  });
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              <Target size={12} strokeWidth={1.5} />
              {idea.in_focus ? "Remove from Focus" : "Mark In Focus"}
            </button>
            {currentView && (
              <>
                <div className="my-1 border-t border-black/5 dark:border-white/5" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowRevealPicker(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  <Eye size={12} strokeWidth={1.5} />
                  Reveal in...
                </button>
              </>
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

      {/* Lane picker flyout */}
      {showLanePicker &&
        menuPos &&
        idea.horizon &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: menuPos.top,
              right: menuPos.right + 200,
              zIndex: 9999,
            }}
            className="glass-card-strong min-w-[160px] rounded-xl py-1.5 shadow-lg"
          >
            <p className="px-3 py-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
              Move to lane
            </p>
            {laneConfigsForIdea.length > 0 && (
              <button
                onClick={() => {
                  void onUpdate(idea.id, { focus_lane: null });
                  setShowLanePicker(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                <span className="w-3">
                  {idea.focus_lane == null && <Check size={12} strokeWidth={2} />}
                </span>
                {unassignedLabel ?? DEFAULT_UNASSIGNED_LABEL}
              </button>
            )}
            {laneConfigsForIdea.map((lane) => (
              <button
                key={lane.id}
                onClick={() => {
                  void onUpdate(idea.id, { focus_lane: lane.id });
                  setShowLanePicker(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                <span className="w-3">
                  {idea.focus_lane === lane.id && <Check size={12} strokeWidth={2} />}
                </span>
                {lane.label}
              </button>
            ))}
            {laneConfigsForIdea.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400 italic">No lanes yet</p>
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

      {showRevealPicker && currentView && menuPos && (
        <RevealInMenu
          idea={idea}
          currentView={currentView}
          position={menuPos}
          onClose={() => setShowRevealPicker(false)}
          allIdeas={allIdeas}
        />
      )}

      {/* Sub-panels */}
      {showLinkPanel && (
        <LinkPanel
          ideaId={idea.id}
          ideas={allIdeas}
          links={links}
          getTagsForIdea={getTagsForIdea}
          onCreateLink={onCreateLink}
          onDeleteLink={onDeleteLink}
          onClose={() => setShowLinkPanel(false)}
        />
      )}
      {showMovePanel && (
        <MoveIdeaPanel
          idea={idea}
          ideas={allIdeas}
          getTagsForIdea={getTagsForIdea}
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
      {showDeleteWarning &&
        createPortal(
          <div
            ref={deleteConfirmRef}
            role="alertdialog"
            aria-label="Confirm delete"
            style={{
              position: "fixed",
              top: deletePos ? deletePos.top : 0,
              right: deletePos ? deletePos.right : 0,
              zIndex: 10000,
            }}
            className="glass-card-strong w-64 rounded-xl border border-red-200 p-3 shadow-lg dark:border-red-500/30"
          >
            <p className="text-xs font-medium text-red-700 dark:text-red-400">
              Delete &ldquo;{idea.text || "empty"}&rdquo;?
            </p>
            {descendantCount > 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {descendantCount === 1
                  ? "1 child idea will be deleted too."
                  : `${descendantCount} child ideas will be deleted too.`}
              </p>
            )}
            <div className="mt-2 flex justify-end gap-1.5">
              <button
                autoFocus
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
          </div>,
          document.body,
        )}
    </div>
  );
}

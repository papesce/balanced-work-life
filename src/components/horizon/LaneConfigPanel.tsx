"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Plus, Trash2, Pencil, MoreHorizontal } from "lucide-react";
import { IdeaHorizon } from "@/lib/types";
import { useLaneConfigsContext } from "@/contexts/LaneConfigsContext";

function SortableLaneRow({
  lane,
  count,
  onRename,
  onDelete,
}: {
  lane: { id: string; label: string; sort_order: number };
  count: number;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lane.id,
  });

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lane.label);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const commit = () => {
    setEditing(false);
    const v = value.trim();
    if (v && v !== lane.label) onRename(lane.id, v);
    else setValue(lane.label);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
        isDragging
          ? "border-indigo-300 bg-indigo-50 shadow-lg dark:border-indigo-600 dark:bg-indigo-950/50"
          : "border-black/5 hover:border-black/10 dark:border-white/5 dark:hover:border-white/10"
      }`}
    >
      <button
        className="flex-shrink-0 cursor-grab touch-none text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>

      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(lane.label);
              setEditing(false);
            }
          }}
          className="flex-1 rounded border border-indigo-300 bg-white px-2 py-0.5 text-sm outline-none focus:border-indigo-500 dark:border-indigo-600 dark:bg-gray-800"
          maxLength={30}
        />
      ) : (
        <span className="flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-200">
          {lane.label}
          {count > 0 && (
            <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{count}</span>
          )}
        </span>
      )}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded p-1 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/5 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-400"
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <div className="absolute top-full right-0 z-50 mt-1 w-36 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-gray-800">
            <button
              onClick={() => {
                setMenuOpen(false);
                setEditing(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <Pencil size={12} /> Rename
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                onDelete(lane.id);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function LaneConfigPanel({
  horizon,
  onClose,
  ideasCountByLane,
}: {
  horizon: IdeaHorizon;
  onClose: () => void;
  ideasCountByLane: (laneId: string) => number;
}) {
  const {
    isLoading,
    getLanesForHorizon,
    getUnassignedLabel,
    createLane,
    updateLaneLabel,
    deleteLane,
    reorderLanes,
    setUnassignedLabel,
  } = useLaneConfigsContext();

  const lanes = getLanesForHorizon(horizon);
  const unassignedLabel = getUnassignedLabel(horizon);

  const [mounted, setMounted] = useState(false);
  const [localUnassigned, setLocalUnassigned] = useState(unassignedLabel);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    label: string;
    count: number;
  } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!horizon) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [horizon, onClose]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = lanes.findIndex((l) => l.id === active.id);
      const newIdx = lanes.findIndex((l) => l.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const sorted = arrayMove(lanes, oldIdx, newIdx);
      void reorderLanes(sorted.map((l) => l.id));
    },
    [lanes, reorderLanes],
  );

  const handleSaveUnassigned = () => {
    const v = localUnassigned.trim();
    if (v && v !== unassignedLabel) {
      void setUnassignedLabel(horizon, v);
    }
  };

  const handleAdd = async () => {
    if (isLoading || adding) return;
    const v = newLabel.trim();
    if (!v || lanes.length >= 5) return;
    setAdding(true);
    try {
      await createLane(horizon, v);
      setNewLabel("");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteConfirm = async (moveToUnassigned: boolean) => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id);
    try {
      await deleteLane(deleteTarget.id, moveToUnassigned);
    } finally {
      setDeleting(null);
      setDeleteTarget(null);
    }
  };

  if (!mounted || !horizon) return null;

  const totalUnassigned = ideasCountByLane("unassigned");

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex h-full w-full max-w-[380px] flex-col bg-white shadow-xl sm:w-[380px] dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3 dark:border-white/5">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">{horizon} lanes</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
              ))}
            </div>
          ) : (
            <>
              {/* Unassigned label */}
              <div className="mb-3">
                <label className="mb-1.5 block text-[11px] font-medium text-gray-400 uppercase dark:text-gray-500">
                  Default lane
                </label>
                <div className="flex gap-2">
                  <input
                    value={localUnassigned}
                    onChange={(e) => setLocalUnassigned(e.target.value)}
                    onBlur={handleSaveUnassigned}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    className="flex-1 rounded-lg border border-dashed border-black/15 px-3 py-2 text-sm outline-none focus:border-solid focus:border-indigo-400 dark:border-white/15 dark:focus:border-indigo-500"
                    maxLength={30}
                  />
                  <span className="flex items-center rounded-lg bg-black/[0.04] px-2.5 py-0 text-xs font-medium text-gray-400 dark:bg-white/[0.06] dark:text-gray-500">
                    {totalUnassigned}
                  </span>
                </div>
              </div>

              {/* Divider */}
              {lanes.length > 0 && (
                <div className="my-4 flex items-center gap-2">
                  <div className="h-px flex-1 bg-black/5 dark:bg-white/5" />
                  <span className="text-[10px] font-medium text-gray-300 dark:text-gray-600">
                    Custom lanes
                  </span>
                  <div className="h-px flex-1 bg-black/5 dark:bg-white/5" />
                </div>
              )}

              {/* Sortable lanes */}
              {lanes.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={lanes.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {lanes.map((lane) => (
                        <SortableLaneRow
                          key={lane.id}
                          lane={lane}
                          count={ideasCountByLane(lane.id)}
                          onRename={(id, label) => void updateLaneLabel(id, label)}
                          onDelete={(id) => {
                            const count = ideasCountByLane(id);
                            setDeleteTarget({ id, label: lane.label, count });
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {/* Add lane */}
              {lanes.length < 5 ? (
                <div className="mt-4 flex gap-2">
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
                    placeholder="New lane label"
                    maxLength={30}
                    disabled={adding}
                    className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none placeholder:text-gray-300 focus:border-indigo-500 disabled:opacity-50 dark:border-white/10 dark:placeholder:text-gray-600"
                  />
                  <button
                    onClick={() => void handleAdd()}
                    disabled={!newLabel.trim() || adding}
                    className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
                  Max 5 lanes
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/30 p-4">
          <div
            className="glass-card w-full max-w-sm rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-sm font-bold text-gray-800 dark:text-gray-200">
              Delete &ldquo;{deleteTarget.label}&rdquo;?
            </h3>
            {deleteTarget.count > 0 ? (
              <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                This lane has {deleteTarget.count} item{deleteTarget.count !== 1 && "s"}. Moving
                them to &ldquo;{localUnassigned}&rdquo;.
              </p>
            ) : (
              <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                This lane is empty and will be permanently deleted.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-black/5 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteConfirm(deleteTarget.count > 0)}
                disabled={deleting === deleteTarget.id}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting === deleteTarget.id
                  ? "Deleting..."
                  : deleteTarget.count > 0
                    ? "Move & Delete"
                    : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

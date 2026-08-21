"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { isDescendantOf, itemsById } from "./buildTree";
import { TreeDndStateProvider, type TreeDndState } from "./context";
import type { DropTarget, DropZone, TreeItem } from "./types";

const ROW_PREFIX = "row:";

function rowIdToItemId(rowId: string): string | null {
  return rowId.startsWith(ROW_PREFIX) ? rowId.slice(ROW_PREFIX.length) : null;
}

/**
 * Pure drop resolution with the same semantics and cycle guards as the
 * original native-HTML5 implementation:
 * - center  -> first child of the target
 * - top     -> sibling above the target
 * - bottom  -> sibling below the target (supports depth snapping via overDepth/targetDepth)
 * Returns null when the move is a no-op or would create a cycle.
 */
export function resolveDropTarget<T extends TreeItem>(
  byId: Map<string, T>,
  draggedId: string,
  overId: string,
  zone: DropZone,
  overDepth?: number,
  targetDepth?: number,
): DropTarget | null {
  if (draggedId === overId) return null;
  const dragged = byId.get(draggedId);
  const over = byId.get(overId);
  if (!dragged || !over) return null;

  if (zone === "center") {
    if (isDescendantOf(byId, over.id, dragged.id)) return null;
    return { parent_id: over.id, sort_order: 0 };
  }

  // Depth-snapped bottom drop: walk up to the ancestor at targetDepth.
  if (
    zone === "bottom" &&
    overDepth !== undefined &&
    targetDepth !== undefined &&
    targetDepth < overDepth
  ) {
    let insertAfter: T | undefined = over;
    let steps = overDepth - targetDepth;
    while (steps-- > 0 && insertAfter?.parent_id) {
      insertAfter = byId.get(insertAfter.parent_id);
    }
    if (!insertAfter) return null;
    if (insertAfter.id === draggedId) return null;
    if (insertAfter.parent_id === draggedId) return null;
    if (insertAfter.parent_id && isDescendantOf(byId, insertAfter.parent_id, draggedId))
      return null;
    return { parent_id: insertAfter.parent_id, sort_order: insertAfter.sort_order + 1 };
  }

  if (over.parent_id === dragged.id) return null;
  if (over.parent_id && isDescendantOf(byId, over.parent_id, dragged.id)) return null;

  return {
    parent_id: over.parent_id,
    sort_order: zone === "top" ? over.sort_order : over.sort_order + 1,
  };
}

interface TreeDndProps<T extends TreeItem> {
  items: T[];
  onMove: (id: string, newParentId: string | null, newSortOrder: number) => void | Promise<void>;
  getLabel: (item: T) => string;
  children: ReactNode;
  indentSize?: number;
}

/**
 * Wraps a tree in a dnd-kit DndContext. Each TreeNodeRow registers itself as
 * a droppable (`row:<id>`) and its grip as draggable (`<id>`). Tracks which
 * third of the target row the pointer is in to resolve above/child/below.
 */
export function TreeDnd<T extends TreeItem>({
  items,
  onMove,
  getLabel,
  children,
  indentSize = 20,
}: TreeDndProps<T>) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [over, setOver] = useState<{
    itemId: string | null;
    zone: DropZone | null;
    targetDepth: number | null;
  }>({
    itemId: null,
    zone: null,
    targetDepth: null,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const byId = useMemo(() => itemsById(items), [items]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveItemId(String(event.active.id));
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const itemId = event.over?.id ? rowIdToItemId(String(event.over.id)) : null;
    const rect = event.over?.rect;
    if (!itemId || !rect || itemId === activeItemId) {
      setOver((prev) =>
        prev.itemId === null && prev.zone === null && prev.targetDepth === null
          ? prev
          : { itemId: null, zone: null, targetDepth: null },
      );
      return;
    }

    let zone: DropZone = "center";
    const activator = event.activatorEvent as Partial<PointerEvent> | null;
    if (typeof activator?.clientY === "number") {
      const pointerY = activator.clientY + event.delta.y;
      const third = rect.height / 3;
      if (pointerY - rect.top < third) zone = "top";
      else if (pointerY - rect.top > third * 2) zone = "bottom";
    }

    let targetDepth: number | null = null;
    if (zone === "bottom") {
      const overDepth: number = event.over?.data.current?.depth ?? 0;
      const depthAdjust = Math.floor(event.delta.x / indentSize);
      targetDepth = Math.max(0, Math.min(overDepth, overDepth + depthAdjust));
    }

    setOver((prev) =>
      prev.itemId === itemId && prev.zone === zone && prev.targetDepth === targetDepth
        ? prev
        : { itemId, zone, targetDepth },
    );
  };

  const reset = () => {
    setActiveItemId(null);
    setOver({ itemId: null, zone: null, targetDepth: null });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const draggedId = String(event.active.id);
    const overId = event.over?.id ? rowIdToItemId(String(event.over.id)) : null;
    if (overId && over.itemId) {
      const overDepth: number = event.over?.data.current?.depth ?? 0;
      const target = resolveDropTarget(
        byId,
        draggedId,
        overId,
        over.zone ?? "center",
        overDepth,
        over.targetDepth ?? undefined,
      );
      if (target) void onMove(draggedId, target.parent_id, target.sort_order);
    }
    reset();
  };

  const handleDragCancel = () => reset();

  const dndState: TreeDndState = {
    activeItemId,
    overItemId: over.itemId,
    zone: over.zone,
    targetDepth: over.targetDepth,
  };

  const activeItem = activeItemId ? byId.get(activeItemId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <TreeDndStateProvider value={dndState}>
        {children}
        <DragOverlay>
          {activeItem ? (
            <div className="flex items-center gap-1 rounded-md border border-indigo-300 bg-white px-2 py-1 text-sm text-gray-800 shadow-lg dark:border-indigo-500/40 dark:bg-gray-800 dark:text-gray-100">
              <GripVertical size={14} className="flex-shrink-0 text-gray-400" />
              <span className="max-w-60 truncate">{getLabel(activeItem)}</span>
            </div>
          ) : null}
        </DragOverlay>
      </TreeDndStateProvider>
    </DndContext>
  );
}

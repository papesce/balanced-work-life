"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import type { Idea, LifeArea } from "@/lib/types";
import { minutesToTimeString } from "./dayslotAdapter";

/**
 * Single drag-and-drop system for the daily planner.
 *
 * Replaces the old dual setup (framer-motion Reorder for sorting + native
 * HTML5 draggable/dataTransfer for timeline + cross-area drops), where a
 * native drop onto the timeline never delivered a pointerup to Framer and the
 * row stayed stuck to the cursor. Everything here is pointer-based dnd-kit:
 * sortable rows, droppable area lanes, and a droppable timeline whose drop
 * minute is derived from pointer geometry instead of dataTransfer.
 */

export const PLANNER_TIMELINE_ID = "planner-timeline";
const LANE_PREFIX = "planner-lane:";

export const plannerLaneId = (area: LifeArea) => `${LANE_PREFIX}${area}`;

export function laneIdToArea(id: string): LifeArea | null {
  if (!id.startsWith(LANE_PREFIX)) return null;
  return id.slice(LANE_PREFIX.length) as LifeArea;
}

export interface PlannerTaskDragData {
  kind: "planner-task";
  taskId: string;
  area: LifeArea;
  title: string;
  durationMinutes: number;
}

/** Prefer the pointer-containing droppable, fall back to nearest center
 *  (same strategy as the tree view; handles keyboard drags). */
const plannerCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
};

export interface TimelineGeometry {
  scrollElement: HTMLDivElement | null;
  startHour: number;
  endHour: number;
  hourHeight: number;
  snapMinutes: number;
}

/** Convert a viewport clientY into a snapped timeline minute. */
export function minuteFromClientY(geom: TimelineGeometry, clientY: number): number | null {
  const { scrollElement, startHour, endHour, hourHeight, snapMinutes } = geom;
  if (!scrollElement || hourHeight <= 0 || snapMinutes <= 0) return null;
  const rect = scrollElement.getBoundingClientRect();
  const raw = startHour * 60 + ((clientY - rect.top + scrollElement.scrollTop) / hourHeight) * 60;
  const min = startHour * 60;
  const max = endHour * 60 - snapMinutes;
  const clamped = Math.min(Math.max(raw, min), max);
  return Math.round(clamped / snapMinutes) * snapMinutes;
}

function pointerClientY(event: DragOverEvent | DragMoveEvent): number | null {
  const activator = event.activatorEvent as Partial<PointerEvent | TouchEvent> | null;
  if (activator && "clientY" in activator && typeof activator.clientY === "number") {
    const deltaY = event.delta?.y ?? 0;
    return activator.clientY + deltaY;
  }
  return null;
}

interface PlannerDndContextValue {
  /** Currently dragged task (null when idle). */
  activeDrag: PlannerTaskDragData | null;
  /** True while the drag is over the timeline. */
  overTimeline: boolean;
  /** Area lane currently hovered, if any. */
  overLane: LifeArea | null;
  /** Live snapped drop minute while over the timeline. */
  timelinePreviewMinute: number | null;
  /** Called by the timeline to publish its scroll body + grid metrics. */
  registerTimeline: (geom: TimelineGeometry) => void;
}

const PlannerDndContext = createContext<PlannerDndContextValue>({
  activeDrag: null,
  overTimeline: false,
  overLane: null,
  timelinePreviewMinute: null,
  registerTimeline: () => {},
});

export function usePlannerDnd(): PlannerDndContextValue {
  return useContext(PlannerDndContext);
}

interface PlannerDndProviderProps {
  children: ReactNode;
  /** Pending (sortable) tasks per area — source of truth for reorder math. */
  pendingByArea: Record<LifeArea, Idea[]>;
  /** Completed tasks per area — only used to resolve drop targets. */
  doneByArea: Record<LifeArea, Idea[]>;
  onSortInArea: (area: LifeArea, taskIds: string[]) => void;
  onMoveBetweenAreas: (
    taskId: string,
    fromArea: LifeArea,
    toArea: LifeArea,
    insertBeforeId: string | null,
  ) => void;
  onSchedule: (taskId: string, startMinute: number) => void;
}

export function PlannerDndProvider({
  children,
  pendingByArea,
  doneByArea,
  onSortInArea,
  onMoveBetweenAreas,
  onSchedule,
}: PlannerDndProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeDrag, setActiveDrag] = useState<PlannerTaskDragData | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [timelinePreviewMinute, setTimelinePreviewMinute] = useState<number | null>(null);
  const previewRef = useRef<number | null>(null);
  const timelineGeomRef = useRef<TimelineGeometry | null>(null);

  const registerTimeline = useCallback((geom: TimelineGeometry) => {
    timelineGeomRef.current = geom;
  }, []);

  /** taskId -> area for every visible task (pending + done). */
  const areaOfTask = useMemo(() => {
    const map = new Map<string, LifeArea>();
    for (const [area, tasks] of Object.entries(pendingByArea)) {
      for (const t of tasks as Idea[]) map.set(t.id, area as LifeArea);
    }
    for (const [area, tasks] of Object.entries(doneByArea)) {
      for (const t of tasks as Idea[]) {
        if (!map.has(t.id)) map.set(t.id, area as LifeArea);
      }
    }
    return map;
  }, [pendingByArea, doneByArea]);

  const reset = useCallback(() => {
    setActiveDrag(null);
    setOverId(null);
    previewRef.current = null;
    setTimelinePreviewMinute(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const data = event.active.data.current as PlannerTaskDragData | undefined;
      const over = event.over?.id ? String(event.over.id) : null;
      if (data?.kind === "planner-task" && over) {
        if (over === PLANNER_TIMELINE_ID) {
          onSchedule(data.taskId, previewRef.current ?? 480);
        } else {
          const laneArea = laneIdToArea(over);
          if (laneArea) {
            if (laneArea !== data.area) onMoveBetweenAreas(data.taskId, data.area, laneArea, null);
          } else {
            // Dropped onto another task row.
            const toArea = areaOfTask.get(over);
            if (toArea) {
              if (toArea === data.area) {
                const ids = pendingByArea[data.area].map((t) => t.id);
                const fromIdx = ids.indexOf(data.taskId);
                const toIdx = ids.indexOf(over);
                if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
                  onSortInArea(data.area, arrayMove(ids, fromIdx, toIdx));
                }
              } else {
                onMoveBetweenAreas(data.taskId, data.area, toArea, over);
              }
            }
          }
        }
      }
      reset();
    },
    [areaOfTask, onMoveBetweenAreas, onSchedule, onSortInArea, pendingByArea, reset],
  );

  const updatePreview = useCallback((event: DragOverEvent | DragMoveEvent) => {
    const over = event.over?.id ? String(event.over.id) : null;
    setOverId(over);
    if (over === PLANNER_TIMELINE_ID && timelineGeomRef.current) {
      const clientY = pointerClientY(event);
      const minute = clientY === null ? null : minuteFromClientY(timelineGeomRef.current, clientY);
      previewRef.current = minute;
      setTimelinePreviewMinute((prev) => (prev === minute ? prev : minute));
    } else if (previewRef.current !== null) {
      previewRef.current = null;
      setTimelinePreviewMinute(null);
    }
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as PlannerTaskDragData | undefined;
    if (data?.kind === "planner-task") setActiveDrag(data);
  }, []);

  const overTimeline = overId === PLANNER_TIMELINE_ID;
  const overLane = overId ? laneIdToArea(overId) : null;

  const contextValue = useMemo<PlannerDndContextValue>(
    () => ({ activeDrag, overTimeline, overLane, timelinePreviewMinute, registerTimeline }),
    [activeDrag, overTimeline, overLane, timelinePreviewMinute, registerTimeline],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={plannerCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={updatePreview}
      onDragMove={updatePreview}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
    >
      <PlannerDndContext.Provider value={contextValue}>
        {children}
        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className="flex max-w-60 items-center gap-1.5 rounded-xl border border-violet-300 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 shadow-xl dark:border-violet-500/40 dark:bg-gray-800 dark:text-gray-100">
              <GripVertical size={12} className="flex-shrink-0 text-gray-400" />
              <span className="min-w-0 flex-1 truncate">{activeDrag.title}</span>
              {overTimeline && timelinePreviewMinute !== null && (
                <span className="flex-shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 tabular-nums dark:bg-violet-900/40 dark:text-violet-300">
                  {minutesToTimeString(timelinePreviewMinute)}
                </span>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </PlannerDndContext.Provider>
    </DndContext>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useReactFlow, type Edge } from "@xyflow/react";
import { isReady, pathProgress } from "@/lib/paths";
import type { PathItem } from "@/lib/paths";
import { LINK_EDGE_STYLE, LINK_TYPE_LABELS } from "@/lib/linkTypes";
import { NODE_WIDTH, type WorkflowTaskNodeData } from "@/components/projects/WorkflowTaskNode";
import type { Idea, IdeaLink, IdeaStatus, Tag } from "@/lib/types";
import type { Node } from "@xyflow/react";

export type FlowNode = Node<WorkflowTaskNodeData>;

interface UseWorkflowGraphParams {
  tasks: Idea[];
  links: IdeaLink[];
  items: PathItem[];
  tagsForTask: (id: string) => Tag[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => Promise<void>;
  onOpenNotes: (id: string) => void;
  onMoveItems: (positions: { ideaId: string; x: number; y: number }[]) => Promise<void>;
  hideCompleted?: boolean;
  hideClosed?: boolean;
  fitTick?: number;
  setMessage: (msg: string) => void;
}

/**
 * Workflow canvas graph state: derived task maps, ReactFlow nodes/edges
 * synced from path items + links, viewport fits, and position persistence.
 */
export function useWorkflowGraph({
  tasks,
  links,
  items,
  tagsForTask,
  onUpdateTask,
  onOpenNotes,
  onMoveItems,
  hideCompleted,
  hideClosed,
  fitTick = 0,
  setMessage,
}: UseWorkflowGraphParams) {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const flow = useReactFlow();

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const placedIds = useMemo(
    () =>
      new Set(
        items.map((n) => n.idea_id).filter((id): id is string => id !== null && taskMap.has(id)),
      ),
    [items, taskMap],
  );
  const statusById = useMemo(
    () => new Map(tasks.map((t) => [t.id, { status: t.status }])),
    [tasks],
  );
  const dependsLinks = useMemo(() => links.filter((l) => l.link_type === "depends_on"), [links]);
  // Derived progress over all members (never persisted) — live-updates with task status.
  const progress = useMemo(() => pathProgress(items, statusById), [items, statusById]);
  // Derived per-node states (never persisted).
  const nodeDerived = useMemo(() => {
    const map = new Map<string, { ready: boolean; done: boolean }>();
    for (const id of placedIds) {
      const task = taskMap.get(id);
      if (!task) continue;
      const done = task.status === "completed" || task.status === "cancelled";
      map.set(id, { ready: !done && isReady(task, dependsLinks, statusById), done });
    }
    return map;
  }, [placedIds, taskMap, dependsLinks, statusById]);
  const visibleIds = useMemo(() => {
    if (hideClosed)
      return new Set(
        [...placedIds].filter((id) => {
          const s = taskMap.get(id)?.status;
          return s !== "completed" && s !== "cancelled" && s !== "missed" && s !== "archived";
        }),
      );
    if (!hideCompleted) return placedIds;
    return new Set([...placedIds].filter((id) => taskMap.get(id)?.status !== "completed"));
  }, [placedIds, taskMap, hideCompleted, hideClosed]);

  const handleUpdateStatus = useCallback(
    (id: string, status: IdeaStatus) => {
      void onUpdateTask(id, { status }).catch(() => setMessage("Could not update status."));
    },
    [onUpdateTask, setMessage],
  );

  const savePositions = useCallback(
    (nextNodes: FlowNode[]) => {
      const positions = nextNodes.map((n) => ({
        ideaId: n.id,
        x: n.position.x,
        y: n.position.y,
      }));
      void onMoveItems(positions).catch(() => setMessage("Could not save canvas. Try again."));
    },
    [onMoveItems, setMessage],
  );

  // Canvas membership is user-controlled and persisted in path_items.
  // Edges reflect all link types between placed steps; the arrow always
  // points in workflow direction (prerequisite -> dependent) so that
  // `depends_on` links are flipped (source depends on target).
  useEffect(() => {
    const savedPositions = new Map(
      items.flatMap((n) => (n.idea_id ? [[n.idea_id, { x: n.x, y: n.y }] as const] : [])),
    );
    const nextNodes: FlowNode[] = [...visibleIds].map((id, i) => ({
      id,
      type: "workflowTask",
      position: savedPositions.get(id) ?? {
        x: 80 + (i % 3) * 260,
        y: 70 + Math.floor(i / 3) * 160,
      },
      style: { width: NODE_WIDTH },
      data: {
        idea: taskMap.get(id)!,
        tags: tagsForTask(id),
        isReady: nodeDerived.get(id)?.ready ?? false,
        isDone: nodeDerived.get(id)?.done ?? false,
        onUpdateStatus: handleUpdateStatus,
        onOpenTask: onOpenNotes,
      },
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes(nextNodes);
    const placed = new Set(nextNodes.map((n) => n.id));
    setEdges(
      links
        .filter((l) => placed.has(l.source_id) && placed.has(l.target_id))
        .map((l) => {
          // depends_on: source depends on target => arrow target -> source.
          // All other types: arrow follows stored direction so the label reads naturally.
          const visual =
            l.link_type === "depends_on"
              ? { source: l.target_id, target: l.source_id }
              : { source: l.source_id, target: l.target_id };
          const style = LINK_EDGE_STYLE[l.link_type] ?? LINK_EDGE_STYLE.related_to;
          return {
            id: l.id,
            source: visual.source,
            target: visual.target,
            type: "smoothstep",
            animated: style.animated ?? false,
            label: LINK_TYPE_LABELS[l.link_type] ?? l.link_type,
            labelStyle: { fontSize: 10, fill: style.stroke },
            labelBgStyle: { fill: "white", fillOpacity: 0.9 },
            style: {
              stroke: style.stroke,
              strokeWidth: 2,
              ...(style.dashed ? { strokeDasharray: "5 5" } : {}),
            },
            markerEnd: { type: "arrowclosed" as const },
          };
        }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, taskMap, links, visibleIds, nodeDerived]);

  // Fit view on mount only; manual canvas, no auto re-fit while arranging.
  useEffect(() => {
    requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 250 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fit after the host pane resizes/collapses (split-view divider drags).
  useEffect(() => {
    if (fitTick === 0) return;
    requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 250 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitTick]);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    flow,
    taskMap,
    placedIds,
    statusById,
    dependsLinks,
    progress,
    nodeDerived,
    visibleIds,
    handleUpdateStatus,
    savePositions,
  };
}

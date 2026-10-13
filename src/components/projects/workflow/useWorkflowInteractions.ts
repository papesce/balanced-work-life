"use client";

import { useCallback, useState } from "react";
import dagre from "dagre";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import { isReady, wouldCreateCycle } from "@/lib/paths";
import type { Idea, IdeaLink, LinkType, Tag } from "@/lib/types";
import { NODE_WIDTH } from "@/components/projects/WorkflowTaskNode";
import type { FlowNode } from "./useWorkflowGraph";

const NODE_HEIGHT = 120;

interface UseWorkflowInteractionsParams {
  edges: Edge[];
  nodes: FlowNode[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  flow: ReactFlowInstance;
  taskMap: Map<string, Idea>;
  tagsForTask: (id: string) => Tag[];
  dependsLinks: IdeaLink[];
  statusById: Map<string, { status: Idea["status"] }>;
  handleUpdateStatus: (id: string, status: Idea["status"]) => void;
  onOpenNotes: (id: string) => void;
  onAddItem: (ideaId: string, x: number, y: number) => Promise<void>;
  onRemoveItem: (ideaId: string) => Promise<void>;
  onCreateLink: (sourceId: string, targetId: string, type: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  isPairInAnotherPath?: (aIdeaId: string, bIdeaId: string) => boolean;
  savePositions: (nodes: FlowNode[]) => void;
  setMessage: (msg: string) => void;
}

/**
 * Canvas interactions: node/edge changes, connect-with-type flow, task
 * placement/removal, dagre auto-layout, and native-drop placement.
 */
export function useWorkflowInteractions({
  edges,
  nodes,
  setNodes,
  setEdges,
  flow,
  taskMap,
  tagsForTask,
  dependsLinks,
  statusById,
  handleUpdateStatus,
  onOpenNotes,
  onAddItem,
  onRemoveItem,
  onCreateLink,
  onDeleteLink,
  isPairInAnotherPath,
  savePositions,
  setMessage,
}: UseWorkflowInteractionsParams) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ visualSource: string; visualTarget: string } | null>(
    null,
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      const removedIds = changes
        .filter((c) => c.type === "remove")
        .map((c) => (c as { id: string }).id);
      setNodes((current) => applyNodeChanges(changes, current) as FlowNode[]);
      // Delete key removes the step from the path only — the task and its links stay intact.
      for (const id of removedIds) {
        void onRemoveItem(id).catch(() => setMessage("Could not remove step. Try again."));
      }
    },
    [onRemoveItem, setMessage, setNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((current) => {
        for (const change of changes) {
          if (change.type !== "remove") continue;
          const edge = current.find((e) => e.id === (change as { id: string }).id);
          if (!edge) continue;
          const shared =
            isPairInAnotherPath?.(edge.source, edge.target) ||
            isPairInAnotherPath?.(edge.target, edge.source);
          void onDeleteLink(edge.id)
            .then(() => {
              if (shared) setMessage("Dependency removed everywhere, not just in this path.");
            })
            .catch(() => setMessage("Could not remove link."));
        }
        return applyEdgeChanges(changes, current);
      });
    },
    [onDeleteLink, isPairInAnotherPath, setEdges, setMessage],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      const current = edges.map(({ id, source, target }) => ({ id, source, target }));
      if (wouldCreateCycle(current, connection.source, connection.target)) {
        setMessage("That connection would create a cycle.");
        return;
      }
      if (current.some((e) => e.source === connection.source && e.target === connection.target)) {
        setMessage("Those steps are already linked — pick a type to add another relationship.");
      }
      // Option B: ask for the relationship type on every connect.
      setPending({ visualSource: connection.source, visualTarget: connection.target });
      setMessage("");
    },
    [edges, setMessage],
  );

  const confirmPendingLink = useCallback(
    (linkType: LinkType) => {
      if (!pending) return;
      const { visualSource, visualTarget } = pending;
      // Keep the canvas arrow (prerequisite -> dependent) for ordering types:
      // depends_on is stored flipped (target depends on source);
      // every other type follows the drawn direction.
      const [storeSource, storeTarget] =
        linkType === "depends_on" ? [visualTarget, visualSource] : [visualSource, visualTarget];
      setPending(null);
      void onCreateLink(storeSource, storeTarget, linkType).catch(() =>
        setMessage("Could not create link."),
      );
      setMessage("");
    },
    [pending, onCreateLink, setMessage],
  );

  const placeTask = useCallback(
    (taskId: string, position?: { x: number; y: number }) => {
      const task = taskMap.get(taskId);
      if (!task) return;
      const pos = position ?? {
        x: 80 + (nodes.length % 3) * 260,
        y: 70 + Math.floor(nodes.length / 3) * 160,
      };
      setNodes((current) => {
        if (current.some((n) => n.id === taskId)) return current;
        return [
          ...current,
          {
            id: taskId,
            type: "workflowTask",
            position: pos,
            style: { width: NODE_WIDTH },
            data: {
              idea: task,
              tags: tagsForTask(taskId),
              isReady: isReady(task, dependsLinks, statusById),
              isDone: task.status === "completed" || task.status === "cancelled",
              onUpdateStatus: handleUpdateStatus,
              onOpenTask: onOpenNotes,
            },
          },
        ];
      });
      void onAddItem(taskId, pos.x, pos.y).catch(() =>
        setMessage("Could not add step. Try again."),
      );
      setSelectedId(taskId);
    },
    [
      taskMap,
      nodes.length,
      tagsForTask,
      handleUpdateStatus,
      onOpenNotes,
      onAddItem,
      dependsLinks,
      statusById,
      setNodes,
      setMessage,
    ],
  );

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    const id = selectedId;
    setNodes((current) => current.filter((n) => n.id !== id));
    void onRemoveItem(id).catch(() => setMessage("Could not remove step. Try again."));
    setSelectedId(null);
  }, [selectedId, onRemoveItem, setNodes, setMessage]);

  const autoLayout = useCallback(() => {
    setNodes((current) => {
      if (!current.length) return current;
      setEdges((currentEdges) => {
        const graph = new dagre.graphlib.Graph();
        graph.setDefaultEdgeLabel(() => ({}));
        graph.setGraph({ rankdir: "LR", nodesep: 45, ranksep: 90 });
        for (const n of current) graph.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
        for (const e of currentEdges) {
          if (graph.hasNode(e.source) && graph.hasNode(e.target)) graph.setEdge(e.source, e.target);
        }
        dagre.layout(graph);
        const next = current.map((n) => {
          const point = graph.node(n.id);
          return point
            ? { ...n, position: { x: point.x - NODE_WIDTH / 2, y: point.y - NODE_HEIGHT / 2 } }
            : n;
        });
        savePositions(next);
        return currentEdges;
      });
      return current;
    });
    requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 250 }));
  }, [flow, savePositions, setNodes, setEdges]);

  const dropTask = (event: React.DragEvent) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("application/project-task");
    if (!taskId || !taskMap.has(taskId)) return;
    placeTask(taskId, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  return {
    selectedId,
    setSelectedId,
    pending,
    setPending,
    handleNodesChange,
    handleEdgesChange,
    onConnect,
    confirmPendingLink,
    placeTask,
    removeSelected,
    autoLayout,
    dropTask,
  };
}

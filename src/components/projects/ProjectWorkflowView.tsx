"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { X } from "lucide-react";
import type { Idea, IdeaLink, IdeaStatus, LinkType, Tag } from "@/lib/types";
import type { PathItem, PathPosition } from "@/lib/paths";
import { isReady, pathProgress, wouldCreateCycle } from "@/lib/paths";
import { LINK_EDGE_STYLE, LINK_TYPES, LINK_TYPE_LABELS } from "@/lib/linkTypes";
import { NODE_WIDTH, WorkflowTaskNode, type WorkflowTaskNodeData } from "./WorkflowTaskNode";

const nodeTypes = { workflowTask: WorkflowTaskNode };
const NODE_HEIGHT = 120;

interface Props {
  tasks: Idea[];
  links: IdeaLink[];
  items: PathItem[];
  onAddItem: (ideaId: string, x: number, y: number) => Promise<void>;
  onRemoveItem: (ideaId: string) => Promise<void>;
  onMoveItems: (positions: PathPosition[]) => Promise<void>;
  tagsForTask: (id: string) => Tag[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => Promise<void>;
  onOpenNotes: (id: string) => void;
  onCreateLink: (sourceId: string, targetId: string, type: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  /** True when both tasks co-occur in some other path (for the delete-everywhere notice). */
  isPairInAnotherPath?: (aIdeaId: string, bIdeaId: string) => boolean;
  /** Mirrors the project "Hide completed" toggle: hides completed nodes on the canvas. */
  hideCompleted?: boolean;
  /** Mirrors the project "Hide closed" toggle: hides completed/cancelled/missed/archived nodes. */
  hideClosed?: boolean;
  /** Bump to re-fit the viewport after the pane resizes or collapses. */
  fitTick?: number;
  /** Fill the parent pane height instead of the fixed 600px canvas. */
  fillHeight?: boolean;
}

type FlowNode = Node<WorkflowTaskNodeData>;

export function ProjectWorkflowView({
  tasks,
  links,
  items,
  onAddItem,
  onRemoveItem,
  onMoveItems,
  tagsForTask,
  onUpdateTask,
  onOpenNotes,
  onCreateLink,
  onDeleteLink,
  isPairInAnotherPath,
  hideCompleted,
  hideClosed,
  fitTick = 0,
  fillHeight = false,
}: Props) {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ visualSource: string; visualTarget: string } | null>(
    null,
  );
  const flow = useReactFlow();

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const placedIds = useMemo(
    () => new Set(items.map((n) => n.idea_id).filter((id) => taskMap.has(id))),
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
    [onUpdateTask],
  );

  const savePositions = useCallback(
    (nextNodes: FlowNode[]) => {
      const positions: PathPosition[] = nextNodes.map((n) => ({
        ideaId: n.id,
        x: n.position.x,
        y: n.position.y,
      }));
      void onMoveItems(positions).catch(() => setMessage("Could not save canvas. Try again."));
    },
    [onMoveItems],
  );

  // Canvas membership is user-controlled and persisted in path_items.
  // Edges reflect all link types between placed steps; the arrow always
  // points in workflow direction (prerequisite -> dependent) so that
  // `depends_on` links are flipped (source depends on target).
  useEffect(() => {
    const savedPositions = new Map(items.map((n) => [n.idea_id, { x: n.x, y: n.y }]));
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
    [onRemoveItem],
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
    [onDeleteLink, isPairInAnotherPath],
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
    [edges],
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
    [pending, onCreateLink],
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
    ],
  );

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    const id = selectedId;
    setNodes((current) => current.filter((n) => n.id !== id));
    void onRemoveItem(id).catch(() => setMessage("Could not remove step. Try again."));
    setSelectedId(null);
  }, [selectedId, onRemoveItem]);

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
  }, [flow, savePositions]);

  const dropTask = (event: React.DragEvent) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("application/project-task");
    if (!taskId || !taskMap.has(taskId)) return;
    placeTask(taskId, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${
        fillHeight ? "flex h-full min-h-[480px] flex-col" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <div className="flex items-center gap-1">
          <span
            className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            title="Completed or cancelled steps out of all steps in this path"
          >
            {progress.done}/{progress.total} done
          </span>
          <button
            onClick={autoLayout}
            disabled={!nodes.length}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
          >
            Auto layout
          </button>
          <button
            onClick={() => flow.fitView({ padding: 0.2, duration: 250 })}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Fit view
          </button>
          {selectedId && (
            <button
              onClick={removeSelected}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              Remove from path
            </button>
          )}
        </div>
      </div>
      {placedIds.size > 8 && (
        <p className="border-b border-gray-200 px-3 py-1.5 text-[11px] text-gray-400 dark:border-gray-700">
          This path is getting large — consider splitting into another path or a sub-project.
        </p>
      )}
      <div
        className={
          fillHeight
            ? "relative min-h-[400px] w-full flex-1"
            : "relative h-[600px] min-h-[560px] w-full"
        }
        onDragOver={(e) => e.preventDefault()}
        onDrop={dropTask}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onPaneClick={() => setSelectedId(null)}
          onNodeDragStop={(_, __, nextNodes) => savePositions(nextNodes as FlowNode[])}
          fitView
          minZoom={0.25}
          maxZoom={1.5}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <Controls position="bottom-left" />
          <MiniMap
            pannable
            zoomable
            style={{ width: 140, height: 100 }}
            className="!border-gray-200 !bg-white/90 dark:!border-gray-700 dark:!bg-gray-800/90"
          />
        </ReactFlow>
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
            <div className="max-w-xs rounded-xl bg-white/90 p-5 shadow dark:bg-gray-800/90">
              <p className="text-sm font-semibold">This path is empty</p>
              <p className="mt-1 text-xs text-gray-500">
                Drag tasks from the TASKS list onto the canvas, then connect them in the order they
                happen.
              </p>
            </div>
          </div>
        )}
        {message && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow">
            {message}
            <button className="ml-2" onClick={() => setMessage("")} aria-label="Dismiss">
              <X size={12} />
            </button>
          </div>
        )}
        {pending && (
          <div className="absolute top-3 left-1/2 w-[min(420px,90%)] -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs font-semibold">
              Link “{taskMap.get(pending.visualSource)?.text ?? "step"}” → “
              {taskMap.get(pending.visualTarget)?.text ?? "step"}” as…
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Arrow stays in the drawn direction; “Depends on” is stored flipped (target depends on
              source).
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LINK_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => confirmPendingLink(value)}
                  title={LINK_TYPE_LABELS[value]}
                  className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-white/10 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10"
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPending(null)}
              className="mt-2 text-[11px] text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectWorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <ProjectWorkflowView {...props} />
    </ReactFlowProvider>
  );
}

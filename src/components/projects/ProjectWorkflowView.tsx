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
import { Plus, X } from "lucide-react";
import type { Idea, IdeaLink, IdeaStatus, Tag } from "@/lib/types";
import type { PathItem, PathPosition } from "@/lib/paths";
import { isReady, pathProgress, wouldCreateCycle } from "@/lib/paths";
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
  onCreateLink: (sourceId: string, targetId: string, type: "depends_on") => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onAddStep: () => Promise<string | null>;
  /** True when both tasks co-occur in some other path (for the delete-everywhere notice). */
  isPairInAnotherPath?: (aIdeaId: string, bIdeaId: string) => boolean;
  /** Mirrors the project "Hide completed" toggle: hides completed nodes on the canvas. */
  hideCompleted?: boolean;
  /** Show the "Project tasks" strip above the canvas. False in split mode (List is the source). */
  showTray?: boolean;
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
  onAddStep,
  isPairInAnotherPath,
  hideCompleted,
  showTray = true,
  fitTick = 0,
  fillHeight = false,
}: Props) {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const [trayOpen, setTrayOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    if (!hideCompleted) return placedIds;
    return new Set([...placedIds].filter((id) => taskMap.get(id)?.status !== "completed"));
  }, [placedIds, taskMap, hideCompleted]);
  // Count how many edges touch each task ID (source or target) — used for tray badges.
  const edgeTaskCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of links.filter((l) => l.link_type === "depends_on")) {
      counts.set(edge.source_id, (counts.get(edge.source_id) ?? 0) + 1);
      counts.set(edge.target_id, (counts.get(edge.target_id) ?? 0) + 1);
    }
    return counts;
  }, [links]);

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
  // Edges reflect depends_on links between placed steps only.
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
        .filter(
          (l) => l.link_type === "depends_on" && placed.has(l.source_id) && placed.has(l.target_id),
        )
        .map((l) => ({
          id: l.id,
          // depends_on: source depends on target => target is the prerequisite.
          source: l.target_id,
          target: l.source_id,
          type: "smoothstep",
          animated: false,
          style: { stroke: "#8b5cf6", strokeWidth: 2 },
          markerEnd: { type: "arrowclosed" as const },
        })),
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
        return;
      }
      // Workflow source -> target means target depends on source.
      void onCreateLink(connection.target, connection.source, "depends_on").catch(() =>
        setMessage("Could not create link."),
      );
      setMessage("");
    },
    [edges, onCreateLink],
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

  const handleAddStep = useCallback(async () => {
    setAdding(true);
    try {
      const id = await onAddStep();
      if (id) {
        placeTask(id);
        setMessage("");
        requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 250 }));
      }
    } catch {
      setMessage("Could not add step. Try again.");
    } finally {
      setAdding(false);
    }
  }, [onAddStep, placeTask, flow]);

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

  const available = useMemo(() => tasks.filter((t) => !placedIds.has(t.id)), [tasks, placedIds]);

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
          {showTray && (
            <button
              onClick={() => setTrayOpen((v) => !v)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {trayOpen ? "Hide tasks" : `Show tasks (${available.length})`}
            </button>
          )}
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
        <button
          onClick={() => void handleAddStep()}
          disabled={adding}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <Plus size={13} /> {adding ? "Adding…" : "+ Add step"}
        </button>
      </div>
      {placedIds.size > 8 && (
        <p className="border-b border-gray-200 px-3 py-1.5 text-[11px] text-gray-400 dark:border-gray-700">
          This path is getting large — consider splitting into another path or a sub-project.
        </p>
      )}
      {showTray && trayOpen && (
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="px-3 pt-2 text-[11px] font-bold text-gray-500">
            Project tasks <span className="font-normal text-gray-400">({available.length})</span>
            <span className="ml-1 font-normal">· drag onto the canvas or press Add</span>
          </div>
          <div className="flex gap-2 overflow-x-auto p-3">
            {available.map((task) => {
              const count = edgeTaskCount.get(task.id) ?? 0;
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/project-task", task.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="flex w-48 shrink-0 cursor-grab items-center gap-2 rounded-lg border border-gray-200 px-2 py-2 text-xs hover:border-violet-300 hover:bg-violet-50 active:cursor-grabbing dark:border-gray-700 dark:hover:bg-violet-950/30"
                >
                  <span className="min-w-0 flex-1 truncate">{task.text || "Untitled task"}</span>
                  {count > 0 && (
                    <span
                      title={`${count} connected step${count === 1 ? "" : "s"}`}
                      className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                    >
                      {count}
                    </span>
                  )}
                  <button
                    onClick={() => placeTask(task.id)}
                    className="shrink-0 rounded-lg border border-violet-200 px-2 py-0.5 font-semibold text-violet-600 hover:bg-violet-100"
                  >
                    Add
                  </button>
                </div>
              );
            })}
            {available.length === 0 && (
              <p className="w-full py-2 text-center text-[11px] text-gray-400">
                Every task in this project is already in this path.
              </p>
            )}
          </div>
        </div>
      )}
      <div
        className={
          fillHeight ? "relative min-h-0 w-full flex-1" : "relative h-[600px] min-h-[560px] w-full"
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
                Add the steps you want here, then connect them in the order they happen.
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

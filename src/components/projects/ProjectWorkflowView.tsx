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
import { NODE_WIDTH, WorkflowTaskNode, type WorkflowTaskNodeData } from "./WorkflowTaskNode";
import { wouldCreateWorkflowCycle, type ProjectWorkflow } from "@/lib/projectWorkflow";

const nodeTypes = { workflowTask: WorkflowTaskNode };
const NODE_HEIGHT = 120;

interface Props {
  tasks: Idea[];
  links: IdeaLink[];
  workflow: ProjectWorkflow;
  onSaveWorkflow: (workflow: ProjectWorkflow) => Promise<void>;
  tagsForTask: (id: string) => Tag[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => Promise<void>;
  onOpenNotes: (id: string) => void;
  onCreateLink: (sourceId: string, targetId: string, type: "depends_on") => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onAddStep: () => Promise<string | null>;
}

type FlowNode = Node<WorkflowTaskNodeData>;

export function ProjectWorkflowView({
  tasks,
  links,
  workflow,
  onSaveWorkflow,
  tagsForTask,
  onUpdateTask,
  onOpenNotes,
  onCreateLink,
  onDeleteLink,
  onAddStep,
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
    () => new Set(workflow.nodes.map((n) => n.taskId).filter((id) => taskMap.has(id))),
    [workflow.nodes, taskMap],
  );
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

  const savePlacement = useCallback(
    (nextNodes: FlowNode[]) => {
      const doc: ProjectWorkflow = {
        version: 1,
        nodes: nextNodes.map((n) => ({ taskId: n.id, position: n.position })),
        edges: [],
      };
      void onSaveWorkflow(doc).catch(() => setMessage("Could not save canvas. Try again."));
    },
    [onSaveWorkflow],
  );

  // Canvas membership is user-controlled and persisted in the workflow document.
  // Edges reflect depends_on links between placed steps only.
  useEffect(() => {
    const savedPositions = new Map(workflow.nodes.map((n) => [n.taskId, n.position]));
    const nextNodes: FlowNode[] = [...placedIds].map((id, i) => ({
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
  }, [workflow, taskMap, links]);

  // Fit view on mount only; manual canvas, no auto re-fit while arranging.
  useEffect(() => {
    requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 250 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      setNodes((current) => {
        const next = applyNodeChanges(changes, current) as FlowNode[];
        // Delete key removes the step from the canvas only — the task and its links stay intact.
        if (changes.some((c) => c.type === "remove")) savePlacement(next);
        return next;
      });
    },
    [savePlacement],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((current) => {
        for (const change of changes) {
          if (change.type !== "remove") continue;
          const edge = current.find((e) => e.id === (change as { id: string }).id);
          if (edge) void onDeleteLink(edge.id).catch(() => setMessage("Could not remove link."));
        }
        return applyEdgeChanges(changes, current);
      });
    },
    [onDeleteLink],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      const current = edges.map(({ id, source, target }) => ({ id, source, target }));
      if (wouldCreateWorkflowCycle(current, connection.source, connection.target)) {
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
      setNodes((current) => {
        if (current.some((n) => n.id === taskId)) return current;
        const task = taskMap.get(taskId);
        if (!task) return current;
        const next: FlowNode[] = [
          ...current,
          {
            id: taskId,
            type: "workflowTask",
            position: position ?? {
              x: 80 + (current.length % 3) * 260,
              y: 70 + Math.floor(current.length / 3) * 160,
            },
            style: { width: NODE_WIDTH },
            data: {
              idea: task,
              tags: tagsForTask(taskId),
              onUpdateStatus: handleUpdateStatus,
              onOpenTask: onOpenNotes,
            },
          },
        ];
        savePlacement(next);
        return next;
      });
      setSelectedId(taskId);
    },
    [taskMap, tagsForTask, handleUpdateStatus, onOpenNotes, savePlacement],
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
    setNodes((current) => {
      const next = current.filter((n) => n.id !== selectedId);
      savePlacement(next);
      return next;
    });
    setSelectedId(null);
  }, [selectedId, savePlacement]);

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
        savePlacement(next);
        return currentEdges;
      });
      return current;
    });
    requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 250 }));
  }, [flow, savePlacement]);

  const available = useMemo(() => tasks.filter((t) => !placedIds.has(t.id)), [tasks, placedIds]);

  const dragTask = (event: React.DragEvent, taskId: string) => {
    event.dataTransfer.setData("application/project-task", taskId);
    event.dataTransfer.effectAllowed = "move";
  };

  const dropTask = (event: React.DragEvent) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("application/project-task");
    if (!taskId || !taskMap.has(taskId)) return;
    placeTask(taskId, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTrayOpen((v) => !v)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {trayOpen ? "Hide tasks" : `Show tasks (${available.length})`}
          </button>
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
              Remove from canvas
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
      {trayOpen && (
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="px-3 pt-2 text-[11px] font-bold text-gray-500">
            Project tasks <span className="font-normal text-gray-400">({available.length})</span>
            <span className="ml-1 font-normal">· drag onto the canvas or press Add</span>
          </div>
          <div className="flex gap-2 overflow-x-auto p-3">
            {available.map((task) => (
              <div
                key={task.id}
                className="flex w-48 shrink-0 cursor-grab items-center gap-2 rounded-lg border border-gray-200 px-2 py-2 text-xs hover:border-violet-300 hover:bg-violet-50 active:cursor-grabbing dark:border-gray-700 dark:hover:bg-violet-950/30"
              >
                <span className="min-w-0 flex-1 truncate">{task.text || "Untitled task"}</span>
                <span
                  className="-top-right absolute flex h-5 w-5 items-center justify-center rounded bg-violet-500 text-xs text-[8px] font-medium text-white"
                  title="Connected steps"
                >
                  {(edgeTaskCount.get(task.id) ?? 0) > 0 ? (edgeTaskCount.get(task.id) ?? 0) : ""}
                </span>
                <button
                  onClick={() => placeTask(task.id)}
                  className="shrink-0 rounded-lg border border-violet-200 px-2 py-0.5 font-semibold text-violet-600 hover:bg-violet-100"
                >
                  Add
                </button>
              </div>
            ))}
            {available.length === 0 && (
              <p className="w-full py-2 text-center text-[11px] text-gray-400">
                Every task in this project is already on the canvas.
              </p>
            )}
          </div>
        </div>
      )}
      <div
        className="relative h-[600px] min-h-[560px] w-full"
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
          onNodeDragStop={(_, __, nextNodes) => savePlacement(nextNodes as FlowNode[])}
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
              <p className="text-sm font-semibold">This canvas is empty</p>
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

"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeChange,
  useNodesInitialized,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { v4 as uuidv4 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "@/hooks/useAuth";
import { usePathManager } from "@/hooks/usePathManager";
import { usePathStepSummary } from "@/hooks/usePathStepSummary";
import type { PathItem, PathPosition } from "@/lib/paths";
import { PathNode } from "./PathNode";
import { useNodesState, useEdgesState } from "@xyflow/react";
import { usePathGraph, type PathFlowNode } from "./path/usePathGraph";
import { usePathInteractions } from "./path/usePathInteractions";
import { PathToolbar } from "./path/PathToolbar";
import { PathPromotePanel } from "./path/PathPromotePanel";
import { PathAssociationPanel } from "./path/PathAssociationPanel";
import { PathEmptyState } from "./path/PathEmptyState";
import type { Idea } from "@/lib/types";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DetailsEditor } from "@/components/shared/DetailsEditor";
import { DetailsDrawer } from "@/components/shared/DetailsDrawer";
import { FileText } from "lucide-react";

const nodeTypes = { pathNode: PathNode };

interface Props {
  pathId: string;
  fillHeight?: boolean;
  projectId?: string;
  projectTasks?: Idea[];
  isNarrow?: boolean;
}

export function PathView({
  pathId,
  fillHeight = false,
  projectId,
  projectTasks = [],
  isNarrow = false,
}: Props) {
  const manager = usePathManager(pathId);
  const stepSummary = usePathStepSummary(pathId);
  const nodesInitialized = useNodesInitialized();
  const initialFitPathId = useRef<string | null>(null);
  const [flowReady, setFlowReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [pathLinksOpen, setPathLinksOpen] = useState(false);
  const [pathDetailsOpen, setPathDetailsOpen] = useState(false);
  const [taskToLink, setTaskToLink] = useState("");
  const [connectionTargetId, setConnectionTargetId] = useState("");
  const [stepsToDelete, setStepsToDelete] = useState<PathItem[]>([]);
  const deletingStepRef = useRef(false);

  const { nodes, edges, flow, itemMap } = usePathGraph({
    items: manager.items,
    edges: manager.edges,
    onMoveNodes: manager.moveNodes,
  });
  const { fitView, getNodes } = flow;
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<PathFlowNode>(nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>(edges);
  useEffect(() => {
    setFlowNodes(nodes);
  }, [nodes, setFlowNodes]);
  useEffect(() => {
    setFlowEdges(edges);
  }, [edges, setFlowEdges]);
  useEffect(() => {
    if (
      manager.loading ||
      !flowReady ||
      !nodesInitialized ||
      nodes.length === 0 ||
      initialFitPathId.current === pathId
    ) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tryFit = async () => {
      if (cancelled) return;
      const registeredIds = new Set(getNodes().map((node) => node.id));
      if (!nodes.every((node) => registeredIds.has(node.id))) {
        if (attempts < 20) {
          attempts += 1;
          timer = setTimeout(() => void tryFit(), 100);
        }
        return;
      }
      const fitted = await fitView({ nodes, padding: 0.2, duration: 250 });
      if (fitted) {
        initialFitPathId.current = pathId;
      } else if (attempts < 10) {
        attempts += 1;
        timer = setTimeout(() => void tryFit(), 100);
      }
    };
    const frame = requestAnimationFrame(() => void tryFit());
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [fitView, flowReady, getNodes, manager.loading, nodes, nodesInitialized, pathId]);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; title: string }>).detail;
      if (detail?.id && detail.title.trim())
        void manager.updateNodeTitle(detail.id, detail.title.trim());
    };
    window.addEventListener("path-node-title", handler);
    return () => window.removeEventListener("path-node-title", handler);
  }, [manager]);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; completed: boolean }>).detail;
      if (!detail?.id) return;
      void manager
        .updatePlanStepCompletion(detail.id, detail.completed)
        .catch((error: unknown) =>
          setMessage(error instanceof Error ? error.message : "Could not update step status."),
        );
    };
    window.addEventListener("path-step-completion", handler);
    return () => window.removeEventListener("path-step-completion", handler);
  }, [manager]);

  const { user } = useAuth();
  const db = usePowerSync();
  const userId = user?.id ?? "";
  const { data: pathRows } = useQuery<Record<string, unknown>>(
    userId
      ? "SELECT text, status FROM ideas WHERE user_id = ? AND id = ? AND type = 'path'"
      : "SELECT * FROM ideas WHERE 0",
    userId ? [userId, pathId] : [],
  );

  const [titleDraft, setTitleDraft] = useState<string>("");
  const currentTitle = String(pathRows[0]?.text ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync title draft when database query updates
    setTitleDraft(currentTitle);
  }, [currentTitle]);

  const { data: links } = useQuery<Record<string, unknown>>(
    userId
      ? "SELECT * FROM idea_links WHERE user_id = ? AND source_id = ? AND link_type = 'path_of'"
      : "SELECT * FROM idea_links WHERE 0",
    userId ? [userId, pathId] : [],
  );
  const associations = useMemo(() => links.map((l) => String(l.target_id)), [links]);

  const handleAssociate = async (targetId: string) => {
    const linkId = uuidv4();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO idea_links (id, user_id, source_id, target_id, link_type, created_at) VALUES (?,?,?,?,?,?)`,
      [linkId, userId, pathId, targetId, "path_of", now],
    );
  };

  const handleDisassociate = async (targetId: string) => {
    await db.execute(
      `DELETE FROM idea_links WHERE source_id = ? AND target_id = ? AND link_type = 'path_of'`,
      [pathId, targetId],
    );
  };

  const updatePathStatus = async (status: string) => {
    await db.execute("UPDATE ideas SET status = ?, updated_at = ? WHERE id = ?", [
      status === "open" ? "draft" : status,
      new Date().toISOString(),
      pathId,
    ]);
  };
  const updatePathTitle = async (title: string) => {
    await db.execute("UPDATE ideas SET text = ?, updated_at = ? WHERE id = ?", [
      title,
      new Date().toISOString(),
      pathId,
    ]);
  };

  const { onConnect, autoLayout, addRandomNode } = usePathInteractions({
    edges,
    nodes,
    setNodes: (updater) => setFlowNodes((current) => updater(current) as PathFlowNode[]),
    setEdges: (updater) => setFlowEdges((current) => updater(current)),
    manager,
    savePositions: manager.moveNodes,
    setMessage,
  });

  const removePathEdge = async (edgeId: string) => {
    try {
      await manager.removeEdge(edgeId);
      setMessage("Connection removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove connection.");
    }
  };
  const handleEdgesChange = (changes: EdgeChange<Edge>[]) => {
    onEdgesChange(changes);
    for (const change of changes) {
      if (change.type !== "remove") continue;
      const pathEdge = manager.edges.find(
        (edge) => `e-${edge.from_item_id}-${edge.to_item_id}` === change.id,
      );
      if (pathEdge) void removePathEdge(pathEdge.id);
    }
  };

  const selectedNode = flowNodes.find((n) => n.id === selectedId);
  const selectedItem = selectedNode && selectedId ? itemMap.get(selectedId) : null;
  const incompleteNodes = nodes.filter((node) => !node.data.isCompleted);
  const rootIncompleteNodes = incompleteNodes.filter(
    (node) => !manager.edges.some((edge) => edge.to_item_id === node.id),
  );
  const nextStepTitle = [
    ...(rootIncompleteNodes.length ? rootIncompleteNodes : incompleteNodes),
  ].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)[0]?.data.title;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${
        fillHeight ? "flex h-full min-h-[480px] flex-col" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <input
          aria-label="Path title"
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={() => {
            const trimmed = titleDraft.trim();
            if (trimmed && trimmed !== currentTitle) {
              void updatePathTitle(trimmed);
            } else {
              setTitleDraft(currentTitle);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          placeholder="Untitled path"
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-gray-700 outline-none dark:text-gray-200"
        />
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPathDetailsOpen(true)}
            aria-label="Open path details"
            title="Path details and notes"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-violet-300"
          >
            <FileText size={14} />
          </button>
          <select
            aria-label="Path status"
            value={
              String(pathRows[0]?.status ?? "draft") === "draft"
                ? "open"
                : String(pathRows[0]?.status)
            }
            onChange={(event) => void updatePathStatus(event.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
          >
            {(["open", "completed", "cancelled", "paused"] as const).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>
      {pathDetailsOpen && (
        <DetailsDrawer
          ideaId={pathId}
          variant="path"
          initialSection="notes"
          onClose={() => setPathDetailsOpen(false)}
        />
      )}
      <PathToolbar
        stepCount={stepSummary.totalSteps}
        completedStepCount={stepSummary.completedSteps}
        nextStepTitle={nextStepTitle ?? null}
        selectedId={selectedId}
        pathLinksOpen={pathLinksOpen}
        onTogglePathLinks={() => setPathLinksOpen((open) => !open)}
        onAutoLayout={autoLayout}
        onFitView={() => fitView({ nodes, padding: 0.2, duration: 250 })}
        onRemoveSelected={(id) => {
          const item = itemMap.get(id);
          if (item) setStepsToDelete([item]);
        }}
        onAddNode={() => void addRandomNode()}
      />

      {pathLinksOpen && (
        <div className="border-b border-gray-200 px-3 py-3 dark:border-gray-700">
          <PathAssociationPanel
            pathId={pathId}
            currentAssociations={associations}
            onAssociate={handleAssociate}
            onDisassociate={handleDisassociate}
            onError={(error) => setMessage(error)}
          />
        </div>
      )}
      <ConfirmDialog
        open={stepsToDelete.length > 0}
        title={
          stepsToDelete.length === 1
            ? `Delete “${stepsToDelete[0].title || "Untitled step"}”?`
            : `Delete ${stepsToDelete.length} steps?`
        }
        body="This will also remove their connections from this path. This action can’t be undone."
        confirmLabel={stepsToDelete.length === 1 ? "Delete step" : "Delete steps"}
        cancelLabel="Cancel"
        onCancel={() => setStepsToDelete([])}
        onConfirm={() => {
          if (stepsToDelete.length === 0 || deletingStepRef.current) return;
          deletingStepRef.current = true;
          void (async () => {
            for (const item of stepsToDelete) {
              await manager.deleteNode(item.id);
            }
          })()
            .then(() => {
              setSelectedId((current) =>
                stepsToDelete.some((item) => item.id === current) ? null : current,
              );
              setStepsToDelete([]);
            })
            .catch((error: unknown) =>
              setMessage(error instanceof Error ? error.message : "Could not delete step."),
            )
            .finally(() => {
              deletingStepRef.current = false;
            });
        }}
      />

      {manager.items.length > 12 && (
        <p className="border-b border-gray-200 px-3 py-1.5 text-[11px] text-gray-400 dark:border-gray-700">
          This path is getting large — consider splitting it into another path.
        </p>
      )}

      <div
        className={
          fillHeight
            ? "relative flex min-h-[400px] w-full flex-1"
            : "relative flex h-[600px] min-h-[560px] w-full"
        }
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("application/project-task")) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event) => {
          const ideaId = event.dataTransfer.getData("application/project-task");
          if (!ideaId) return;
          event.preventDefault();
          event.stopPropagation();
          const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
          void manager
            .addExistingIdea(ideaId, position.x, position.y)
            .then(() => setMessage("Idea added to path."))
            .catch((error: unknown) => {
              setMessage(error instanceof Error ? error.message : "Could not add idea to path.");
            });
        }}
      >
        {message && (
          <p
            role="status"
            className="absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-gray-200 bg-white/95 px-3 py-1.5 text-xs text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900/95"
          >
            {message}
          </p>
        )}
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            onInit={() => setFlowReady(true)}
            nodesDraggable={nodesInitialized}
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onBeforeDelete={async ({ nodes: nodesToRemove }) => {
              if (nodesToRemove.length === 0) return true;
              const items = nodesToRemove
                .map((node) => itemMap.get(node.id))
                .filter((item): item is PathItem => Boolean(item));
              if (items.length > 0) setStepsToDelete(items);
              return false;
            }}
            onNodeClick={(_, node) => {
              setSelectedId(node.id);
              setTaskToLink("");
              setConnectionTargetId("");
            }}
            onPaneClick={() => setSelectedId(null)}
            onNodeDragStop={(_, node) => {
              const positions: PathPosition[] = [
                {
                  itemId: node.id,
                  x: node.position.x,
                  y: node.position.y,
                },
              ];
              void manager.moveNodes(positions);
            }}
            fitView
            minZoom={0.25}
            maxZoom={1.5}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background gap={20} size={1} />
            <Controls position="bottom-left" />
            <MiniMap
              pannable
              zoomable
              style={{ width: 140, height: 100 }}
              className="!border-gray-200 !bg-white/90 dark:!border-gray-800/90"
            />
          </ReactFlow>
          {nodes.length === 0 && <PathEmptyState onAdd={() => void addRandomNode()} />}
        </div>

        {selectedId && selectedItem && (
          <aside
            aria-label="Step inspector"
            className={`z-10 flex flex-col gap-3 overflow-y-auto border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 ${
              isNarrow
                ? "absolute inset-x-0 bottom-0 max-h-[60%] rounded-t-2xl border-t shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
                : "w-[min(100%,280px)] shrink-0 border-l max-[640px]:absolute max-[640px]:inset-x-0 max-[640px]:bottom-0 max-[640px]:max-h-[60%] max-[640px]:w-full max-[640px]:rounded-t-2xl max-[640px]:border-t max-[640px]:border-l-0 max-[640px]:shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Step details
              </h3>
              <button
                type="button"
                aria-label="Close step inspector"
                onClick={() => setSelectedId(null)}
                className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Step name
              <input
                key={`${selectedId}-${selectedItem.title}`}
                defaultValue={selectedItem.title}
                onBlur={(event) => {
                  const title = event.currentTarget.value.trim();
                  if (title && title !== selectedItem.title) {
                    void manager
                      .updateNodeTitle(selectedId, title)
                      .catch((error: unknown) =>
                        setMessage(
                          error instanceof Error ? error.message : "Could not rename step.",
                        ),
                      );
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-800 focus-visible:outline-2 focus-visible:outline-violet-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>

            <section className="space-y-1.5 border-t border-gray-200 pt-3 dark:border-gray-700">
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  Step note
                </h4>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  Planning context for this step. Task notes stay with the linked task.
                </p>
              </div>
              <DetailsEditor
                key={`notes-${selectedId}`}
                value={selectedItem.notes ?? null}
                placeholder="Add a short note about this step…"
                onSave={(notes) => {
                  void manager
                    .updateNodeNotes(selectedId, notes)
                    .catch((error: unknown) =>
                      setMessage(
                        error instanceof Error ? error.message : "Could not save step note.",
                      ),
                    );
                }}
              />
            </section>

            <section className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-700">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200">Sequence</h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                This step happens before:
              </p>
              <div className="flex gap-2">
                <select
                  aria-label="Choose the next step"
                  value={connectionTargetId}
                  onChange={(event) => setConnectionTargetId(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="">Choose a step</option>
                  {manager.items
                    .filter(
                      (item) =>
                        item.id !== selectedId &&
                        !manager.edges.some(
                          (edge) => edge.from_item_id === selectedId && edge.to_item_id === item.id,
                        ),
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title || "Untitled step"}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!connectionTargetId}
                  onClick={() => {
                    if (!connectionTargetId) return;
                    void manager
                      .addEdge(selectedId, connectionTargetId)
                      .then(() => setConnectionTargetId(""))
                      .catch((error: unknown) =>
                        setMessage(
                          error instanceof Error ? error.message : "Could not connect steps.",
                        ),
                      );
                  }}
                  className="rounded-lg bg-violet-600 px-2.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Connect
                </button>
              </div>
              {manager.edges
                .filter((edge) => edge.from_item_id === selectedId)
                .map((edge) => (
                  <div
                    key={edge.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800"
                  >
                    <span className="truncate">
                      Before {itemMap.get(edge.to_item_id)?.title ?? "another step"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void removePathEdge(edge.id)}
                      aria-label={`Remove sequence connection to ${itemMap.get(edge.to_item_id)?.title ?? "step"}`}
                      className="shrink-0 rounded px-2 py-1 text-gray-500 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-gray-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
            </section>

            {selectedItem.idea_id ? (
              <div className="rounded-lg bg-violet-50 p-2.5 text-xs text-violet-900 dark:bg-violet-900/30 dark:text-violet-100">
                <p className="font-semibold">
                  {selectedItem.promoted_at ? "Task created from this step" : "Linked task"}
                </p>
                <p className="mt-1 break-words">{selectedItem.idea_text ?? selectedItem.title}</p>
                <p className="mt-1 text-violet-700 capitalize dark:text-violet-300">
                  {String(selectedItem.idea_status ?? "unknown").replaceAll("_", " ")}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void manager
                      .unlinkNodeTask(selectedId)
                      .catch((error: unknown) =>
                        setMessage(
                          error instanceof Error ? error.message : "Could not unlink task.",
                        ),
                      )
                  }
                  className="mt-2 rounded-md border border-violet-200 px-2 py-1 font-medium hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-500 dark:border-violet-700 dark:hover:bg-violet-800"
                >
                  Unlink task
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Plan-only step · {selectedItem.completed_at ? "Done" : "Not done"}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void manager
                      .updatePlanStepCompletion(selectedId, !Boolean(selectedItem.completed_at))
                      .catch((error: unknown) =>
                        setMessage(
                          error instanceof Error ? error.message : "Could not update step status.",
                        ),
                      )
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-violet-500 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Mark {selectedItem.completed_at ? "not done" : "done"}
                </button>
                {projectId && (
                  <>
                    {projectTasks.length > 0 ? (
                      <>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                          Link existing task
                          <select
                            value={taskToLink}
                            onChange={(event) => setTaskToLink(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"
                          >
                            <option value="">Choose a project task</option>
                            {projectTasks
                              .filter(
                                (task) =>
                                  !manager.items.some(
                                    (item) => item.idea_id === task.id && item.id !== selectedId,
                                  ),
                              )
                              .map((task) => (
                                <option key={task.id} value={task.id}>
                                  {task.text}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={!taskToLink}
                          onClick={() => {
                            void manager
                              .linkNodeToTask(selectedId, taskToLink)
                              .then(() => setTaskToLink(""))
                              .catch((error: unknown) =>
                                setMessage(
                                  error instanceof Error
                                    ? error.message
                                    : "Could not link this task.",
                                ),
                              );
                          }}
                          className="w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Link task
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        No project tasks yet. Create one from this step.
                      </p>
                    )}
                  </>
                )}
                <PathPromotePanel
                  key={selectedId}
                  item={{ title: selectedItem.title, ideaId: selectedItem.idea_id }}
                  onPromote={async (title) => {
                    try {
                      await manager.promoteNode(selectedId, title);
                      setMessage(
                        projectId ? "Step created as a project task." : "Step promoted to task.",
                      );
                      setPromotingId(null);
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Promotion failed.");
                    }
                  }}
                  onCancel={() => setPromotingId(null)}
                  isPromoting={promotingId === selectedId}
                  setPromoting={() => setPromotingId(selectedId)}
                />
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

export function PathCanvasProvider({ children }: { children: React.ReactNode }) {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
}

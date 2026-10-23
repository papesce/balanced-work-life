"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { v4 as uuidv4 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "@/hooks/useAuth";
import { usePathManager } from "@/hooks/usePathManager";
import type { PathPosition } from "@/lib/paths";
import { PathNode } from "./PathNode";
import { useNodesState, useEdgesState } from "@xyflow/react";
import { usePathGraph, type PathFlowNode } from "./path/usePathGraph";
import { usePathInteractions } from "./path/usePathInteractions";
import { PathToolbar } from "./path/PathToolbar";
import { PathPromotePanel } from "./path/PathPromotePanel";
import { PathAssociationPanel } from "./path/PathAssociationPanel";
import { PathEmptyState } from "./path/PathEmptyState";

const nodeTypes = { pathNode: PathNode };

interface Props {
  pathId: string;
  fillHeight?: boolean;
}

export function PathView({ pathId, fillHeight = false }: Props) {
  const manager = usePathManager(pathId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setMessage] = useState("");
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const { nodes, edges, flow, itemMap } = usePathGraph({
    items: manager.items,
    edges: manager.edges,
    onMoveNodes: manager.moveNodes,
  });
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<PathFlowNode>(nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>(edges);
  useEffect(() => {
    setFlowNodes(nodes);
  }, [nodes, setFlowNodes]);
  useEffect(() => {
    setFlowEdges(edges);
  }, [edges, setFlowEdges]);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; title: string }>).detail;
      if (detail?.id && detail.title.trim())
        void manager.updateNodeTitle(detail.id, detail.title.trim());
    };
    window.addEventListener("path-node-title", handler);
    return () => window.removeEventListener("path-node-title", handler);
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

  const selectedNode = flowNodes.find((n) => n.id === selectedId);
  const selectedItem = selectedNode && selectedId ? itemMap.get(selectedId) : null;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${
        fillHeight ? "flex h-full min-h-[480px] flex-col" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <input
          aria-label="Path title"
          key={pathId}
          defaultValue={String(pathRows[0]?.text ?? "Untitled path")}
          onBlur={(event) => {
            const title = event.currentTarget.value.trim();
            if (title) void updatePathTitle(title);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-gray-700 outline-none dark:text-gray-200"
        />
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
      <PathToolbar
        nodeCount={nodes.length}
        selectedId={selectedId}
        onAutoLayout={autoLayout}
        onFitView={() => flow.fitView({ padding: 0.2, duration: 250 })}
        onRemoveSelected={() => {
          if (selectedId) {
            void manager.deleteNode(selectedId);
            setSelectedId(null);
          }
        }}
        onAddNode={() => void addRandomNode()}
      />

      {manager.items.length > 12 && (
        <p className="border-b border-gray-200 px-3 py-1.5 text-[11px] text-gray-400 dark:border-gray-700">
          This path is getting large — consider splitting it into another path.
        </p>
      )}

      <div
        className={
          fillHeight
            ? "relative min-h-[400px] w-full flex-1"
            : "relative h-[600px] min-h-[560px] w-full"
        }
      >
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedId(node.id)}
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
          proOptions={{ hideAttribution: true }}
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

        {selectedId && selectedItem && (
          <div className="absolute right-4 bottom-4 z-10 flex flex-col gap-2">
            <PathAssociationPanel
              pathId={pathId}
              currentAssociations={associations}
              onAssociate={handleAssociate}
              onDisassociate={handleDisassociate}
            />
            <PathPromotePanel
              item={{ title: selectedItem.title, ideaId: selectedItem.idea_id }}
              onPromote={async (title) => {
                try {
                  await manager.promoteNode(selectedId, title);
                  setMessage("Node promoted to task!");
                  setPromotingId(null);
                } catch {
                  setMessage("Promotion failed.");
                }
              }}
              onCancel={() => setPromotingId(null)}
              isPromoting={promotingId !== null}
              setPromoting={() => setPromotingId(selectedId)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function PathCanvasProvider({ children }: { children: React.ReactNode }) {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
}

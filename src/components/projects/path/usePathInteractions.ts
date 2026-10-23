"use client";

import {
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import dagre from "dagre";
import { type PathPosition } from "@/lib/paths";
import { usePathManager } from "@/hooks/usePathManager";

interface PathInteractionsProps {
  edges: Edge[];
  nodes: Node[];
  setNodes: (updater: (nodes: Node[]) => Node[]) => void;
  setEdges: (updater: (edges: Edge[]) => Edge[]) => void;
  manager: ReturnType<typeof usePathManager>;
  savePositions: (positions: PathPosition[]) => Promise<void>;
  setMessage: (msg: string) => void;
}

export function usePathInteractions({
  edges,
  nodes,
  setNodes,
  setEdges,
  manager,
  savePositions,
  setMessage,
}: PathInteractionsProps) {
  const { setNodes: setFlowNodes } = useReactFlow();
  const handleNodesChange = (changes: NodeChange[]) =>
    setNodes((current) => applyNodeChanges(changes, current));
  const handleEdgesChange = (changes: EdgeChange[]) =>
    setEdges((current: Edge[]) => applyEdgeChanges(changes, current));

  const onConnect = async (params: Connection) => {
    try {
      await manager.addEdge(params.source, params.target);
    } catch {
      setMessage("Could not create connection.");
    }
  };

  const removeSelected = async (id: string) => {
    await manager.deleteNode(id);
  };

  const addRandomNode = async () => {
    const x = Math.random() * 400;
    const y = Math.random() * 400;
    await manager.addNode("New Step", x, y);
  };

  const autoLayout = async () => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 100 });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((node) => {
      g.setNode(node.id, { width: 150, height: 50 });
    });

    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    const layoutedNodes = nodes.map((node) => {
      const nodeWithPos = g.node(node.id);
      return {
        ...node,
        position: { x: nodeWithPos.x, y: nodeWithPos.y },
      };
    });

    setFlowNodes(layoutedNodes);
    await savePositions(
      layoutedNodes.map((node) => ({ itemId: node.id, x: node.position.x, y: node.position.y })),
    );
  };

  return {
    handleNodesChange,
    handleEdgesChange,
    onConnect,
    removeSelected,
    autoLayout,
    addRandomNode,
  };
}

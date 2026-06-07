"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Idea, IdeaLink } from "@/lib/types";
import { GraphIdeaNode, type GraphIdeaNodeData } from "./GraphIdeaNode";

interface GraphViewProps {
  ideas: Idea[];
  links: IdeaLink[];
  onNodeDoubleClick?: (ideaId: string) => void;
}

const LINK_TYPE_LABELS: Record<string, string> = {
  unblocks: "unblocks",
  contributes_to: "contributes to",
  depends_on: "depends on",
  related_to: "related",
  part_of: "part of",
};

const nodeTypes = { ideaNode: GraphIdeaNode };

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 120 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 180, height: 50 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 90, y: pos.y - 25 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export function GraphView({ ideas, links, onNodeDoubleClick }: GraphViewProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const connectedIds = new Set<string>();
    links.forEach((l) => {
      connectedIds.add(l.source_id);
      connectedIds.add(l.target_id);
    });

    // Also include ideas with parent-child relationships to connected nodes
    ideas.forEach((idea) => {
      if (idea.parent_id && connectedIds.has(idea.parent_id)) {
        connectedIds.add(idea.id);
      }
      if (connectedIds.has(idea.id) && idea.parent_id) {
        connectedIds.add(idea.parent_id);
      }
    });

    const visibleIdeas = ideas.filter((i) => connectedIds.has(i.id));

    const nodes: Node[] = visibleIdeas.map((idea) => ({
      id: idea.id,
      type: "ideaNode",
      position: { x: 0, y: 0 },
      data: {
        label: idea.text || "untitled",
        type: idea.type,
        area: idea.area,
      } as GraphIdeaNodeData,
    }));

    const edges: Edge[] = [];

    // Add typed links as solid edges
    links.forEach((link) => {
      edges.push({
        id: `link-${link.id}`,
        source: link.source_id,
        target: link.target_id,
        label: LINK_TYPE_LABELS[link.link_type] || link.link_type,
        type: "default",
        style: { stroke: "#6366f1" },
        labelStyle: { fontSize: 10, fill: "#6366f1" },
      });
    });

    // Add parent-child relationships as dashed edges
    visibleIdeas.forEach((idea) => {
      if (idea.parent_id && connectedIds.has(idea.parent_id)) {
        edges.push({
          id: `parent-${idea.id}`,
          source: idea.parent_id,
          target: idea.id,
          type: "default",
          style: { stroke: "#d1d5db", strokeDasharray: "5 5" },
          animated: false,
        });
      }
    });

    const layouted = getLayoutedElements(nodes, edges);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [ideas, links]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeDoubleClick?.(node.id);
    },
    [onNodeDoubleClick]
  );

  if (initialNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] text-gray-400 text-sm italic">
        No linked ideas to display. Create links between ideas to see the graph.
      </div>
    );
  }

  return (
    <div className="h-[600px] w-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Controls position="bottom-right" />
        <Background gap={20} size={1} />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-white/80 dark:!bg-gray-800/80 !border-gray-200 dark:!border-gray-700"
        />
      </ReactFlow>
    </div>
  );
}

"use client";

import { useMemo, useCallback, useEffect } from "react";
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
import { getFocusedSubtreeIds } from "@/lib/ideaTreeFocus";
import { GraphIdeaNode, type GraphIdeaNodeData } from "./GraphIdeaNode";

interface GraphViewProps {
  ideas: Idea[];
  links: IdeaLink[];
  focusedId?: string | null;
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

export function GraphView({ ideas, links, focusedId, onNodeDoubleClick }: GraphViewProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    let scopedLinks = links;
    if (focusedId) {
      const focusIds = getFocusedSubtreeIds(focusedId, ideas);
      scopedLinks = links.filter((l) => focusIds.has(l.source_id) && focusIds.has(l.target_id));
    }

    const connectedIds = new Set<string>();
    scopedLinks.forEach((l) => {
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
      } as GraphIdeaNodeData,
    }));

    const edges: Edge[] = [];

    // Add typed links as solid edges
    scopedLinks.forEach((link) => {
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
  }, [ideas, links, focusedId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Re-sync graph when the underlying data (ideas/links/focus) changes.
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeDoubleClick?.(node.id);
    },
    [onNodeDoubleClick],
  );

  if (initialNodes.length === 0) {
    return (
      <div className="flex h-[500px] items-center justify-center text-sm text-gray-400 italic">
        {focusedId
          ? "No linked ideas in this focus. Create links between focused ideas to see the graph."
          : "No linked ideas to display. Create links between ideas to see the graph."}
      </div>
    );
  }

  return (
    <div className="h-[600px] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
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
          className="!border-gray-200 !bg-white/80 dark:!border-gray-700 dark:!bg-gray-800/80"
        />
      </ReactFlow>
    </div>
  );
}

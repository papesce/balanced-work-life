import dagre from "dagre";
import type { PathItem, PathEdge } from "@/lib/paths";

export interface LayoutedNode {
  id: string;
  title: string;
  ideaId: string | null;
  status: string; // "placeholder" | idea status ("todo", "in_progress", "completed", etc.)
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutedEdge {
  id: string;
  from: string;
  to: string;
  points: { x: number; y: number }[];
}

export interface PathLayout {
  width: number;
  height: number;
  nodes: LayoutedNode[];
  edges: LayoutedEdge[];
}

export function computePathLayout(
  items: PathItem[],
  edges: PathEdge[],
  promotedStatuses: Record<string, string> = {},
  options: {
    nodeWidth?: number;
    nodeHeight?: number;
    rankSep?: number;
    nodeSep?: number;
    padding?: number;
  } = {},
): PathLayout {
  if (items.length === 0) {
    return { width: 0, height: 0, nodes: [], edges: [] };
  }

  const nodeWidth = options.nodeWidth ?? 120;
  const nodeHeight = options.nodeHeight ?? 32;
  const rankSep = options.rankSep ?? 40;
  const nodeSep = options.nodeSep ?? 20;
  const padding = options.padding ?? 16;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "LR",
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: padding,
    marginy: padding,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const item of items) {
    g.setNode(item.id, { width: nodeWidth, height: nodeHeight });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.from_item_id) && g.hasNode(edge.to_item_id)) {
      g.setEdge(edge.from_item_id, edge.to_item_id);
    }
  }

  dagre.layout(g);

  const itemMap = new Map(items.map((i) => [i.id, i]));
  const layoutedNodes: LayoutedNode[] = [];

  for (const nodeId of g.nodes()) {
    const nodeInfo = g.node(nodeId);
    if (!nodeInfo) continue;
    const item = itemMap.get(nodeId);
    if (!item) continue;

    const status = item.idea_id ? (promotedStatuses[item.idea_id] ?? "todo") : "placeholder";

    layoutedNodes.push({
      id: item.id,
      title: item.title,
      ideaId: item.idea_id,
      status,
      x: nodeInfo.x - nodeWidth / 2,
      y: nodeInfo.y - nodeHeight / 2,
      width: nodeWidth,
      height: nodeHeight,
    });
  }

  const layoutedEdges: LayoutedEdge[] = [];
  for (const edgeObj of g.edges()) {
    const edgeInfo = g.edge(edgeObj);
    if (!edgeInfo || !edgeInfo.points) continue;
    layoutedEdges.push({
      id: `e-${edgeObj.v}-${edgeObj.w}`,
      from: edgeObj.v,
      to: edgeObj.w,
      points: edgeInfo.points,
    });
  }

  const graphInfo = g.graph();
  const width = Math.max(100, (graphInfo.width || 0) + padding * 2);
  const height = Math.max(60, (graphInfo.height || 0) + padding * 2);

  return {
    width,
    height,
    nodes: layoutedNodes,
    edges: layoutedEdges,
  };
}

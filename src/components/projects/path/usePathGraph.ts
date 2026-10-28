"use client";

import { useMemo } from "react";
import { MarkerType, useReactFlow, type Node } from "@xyflow/react";
import { isPathStepComplete, type PathItem, type PathEdge } from "@/lib/paths";
import type { PathPosition } from "@/lib/paths";

export interface PathFlowNode extends Node {
  data: {
    title: string;
    hasNotes: boolean;
    ideaId: string | null;
    ideaText: string | null;
    ideaStatus: string | null;
    isLinked: boolean;
    isPromoted: boolean;
    isCompleted: boolean;
  };
}

interface PathGraphProps {
  items: PathItem[];
  edges: PathEdge[];
  onMoveNodes: (positions: PathPosition[]) => Promise<void>;
}

export function usePathGraph({ items, edges }: PathGraphProps) {
  const { setViewport, fitView, getNodes, screenToFlowPosition } = useReactFlow();

  const itemMap = useMemo(() => {
    const map = new Map<string, PathItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  const nodes = useMemo(() => {
    return items.map((item) => ({
      id: item.id,
      type: "pathNode",
      position: { x: item.x, y: item.y },
      data: {
        title: item.title,
        hasNotes: Boolean(item.notes?.trim()),
        ideaId: item.idea_id,
        ideaText: item.idea_text ?? null,
        ideaStatus: item.idea_status ?? null,
        isLinked: Boolean(item.idea_id),
        isPromoted: Boolean(item.promoted_at),
        isCompleted: isPathStepComplete(item.completed_at, item.idea_status),
      },
    })) as PathFlowNode[];
  }, [items]);

  const flowEdges = useMemo(() => {
    return edges.map((edge) => ({
      id: `e-${edge.from_item_id}-${edge.to_item_id}`,
      source: edge.from_item_id,
      target: edge.to_item_id,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2, stroke: "#8b5cf6" },
    }));
  }, [edges]);

  return {
    nodes,
    edges: flowEdges,
    flow: { fitView, getNodes, setViewport, screenToFlowPosition },
    itemMap,
  };
}

"use client";

import { useMemo } from "react";
import { usePathGraphData } from "@/hooks/usePathGraphData";
import { computePathLayout, type LayoutedEdge } from "@/lib/pathLayout";

export interface PathPreviewSvgProps {
  pathId: string;
  className?: string;
  compact?: boolean;
}

function getNodeStyles(status: string) {
  switch (status) {
    case "completed":
      return {
        fill: "fill-violet-50 dark:fill-violet-950/40",
        stroke: "stroke-violet-300 dark:stroke-violet-700",
        text: "fill-violet-700 dark:fill-violet-300 font-semibold",
      };
    case "in_progress":
      return {
        fill: "fill-amber-50 dark:fill-amber-950/40",
        stroke: "stroke-amber-300 dark:stroke-amber-600",
        text: "fill-amber-800 dark:fill-amber-200 font-semibold",
      };
    case "cancelled":
    case "missed":
      return {
        fill: "fill-red-50 dark:fill-red-950/40",
        stroke: "stroke-red-300 dark:stroke-red-800",
        text: "fill-red-700 dark:fill-red-300 line-through",
      };
    case "paused":
      return {
        fill: "fill-orange-50 dark:fill-orange-950/40",
        stroke: "stroke-orange-300 dark:stroke-orange-700",
        text: "fill-orange-700 dark:fill-orange-300",
      };
    case "placeholder":
      return {
        fill: "fill-white/80 dark:fill-gray-900/60",
        stroke: "stroke-gray-300 dark:stroke-gray-700 stroke-dashed",
        text: "fill-gray-500 dark:fill-gray-400 italic",
      };
    default:
      // Real task ("todo", "backlog", "open", etc.)
      return {
        fill: "fill-white dark:fill-gray-800",
        stroke: "stroke-gray-300 dark:stroke-gray-600",
        text: "fill-gray-700 dark:fill-gray-200 font-medium",
      };
  }
}

function createSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    const [p0, p1] = points;
    const dx = (p1.x - p0.x) / 2;
    return `M ${p0.x} ${p0.y} C ${p0.x + dx} ${p0.y}, ${p1.x - dx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

export function PathPreviewSvg({ pathId, className = "", compact = false }: PathPreviewSvgProps) {
  const { items, edges, promotedStatuses, loading } = usePathGraphData(pathId);

  const layout = useMemo(() => {
    return computePathLayout(items, edges, promotedStatuses, {
      nodeWidth: compact ? 100 : 120,
      nodeHeight: compact ? 26 : 30,
      rankSep: compact ? 30 : 40,
      nodeSep: compact ? 12 : 16,
      padding: compact ? 10 : 14,
    });
  }, [items, edges, promotedStatuses, compact]);

  if (loading && items.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center text-xs text-gray-400">
        Loading path preview...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 dark:border-gray-800">
        Empty path (no steps yet)
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto py-1 ${className}`}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{
          width: "100%",
          maxWidth: `${layout.width}px`,
          height: `${layout.height}px`,
          minHeight: `${layout.height}px`,
        }}
        className="block select-none"
      >
        <defs>
          <marker
            id={`arrow-${pathId}`}
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" className="fill-gray-400 dark:fill-gray-500" />
          </marker>
        </defs>

        {/* Edges */}
        <g className="edges">
          {layout.edges.map((edge: LayoutedEdge) => (
            <path
              key={edge.id}
              d={createSmoothPath(edge.points)}
              fill="none"
              className="stroke-gray-300 dark:stroke-gray-600"
              strokeWidth="1.5"
              markerEnd={`url(#arrow-${pathId})`}
            />
          ))}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {layout.nodes.map((node) => {
            const styles = getNodeStyles(node.status);
            const isPlaceholder = node.status === "placeholder";
            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                <rect
                  width={node.width}
                  height={node.height}
                  rx="6"
                  ry="6"
                  className={`${styles.fill} ${styles.stroke}`}
                  strokeWidth="1"
                  strokeDasharray={isPlaceholder ? "3,3" : undefined}
                />
                <text
                  x={node.width / 2}
                  y={node.height / 2 + 3.5}
                  textAnchor="middle"
                  className={`text-[11px] select-none ${styles.text}`}
                  style={{ pointerEvents: "none" }}
                >
                  {node.title.length > 15 ? `${node.title.slice(0, 14)}…` : node.title}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

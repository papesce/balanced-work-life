"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { IdeaType, LifeArea } from "@/lib/types";

const AREA_BG: Record<LifeArea, string> = {
  work: "bg-blue-50 border-blue-300",
  health: "bg-red-50 border-red-300",
  relationships: "bg-pink-50 border-pink-300",
  growth: "bg-amber-50 border-amber-300",
  finances: "bg-emerald-50 border-emerald-300",
  life: "bg-green-50 border-green-300",
};

export interface GraphIdeaNodeData {
  label: string;
  type: IdeaType | null;
  area: LifeArea | null;
  [key: string]: unknown;
}

function GraphIdeaNodeComponent({ data }: NodeProps) {
  const nodeData = data as GraphIdeaNodeData;
  const bgClass = nodeData.area ? AREA_BG[nodeData.area] : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600";

  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-400" />
      <div
        className={`px-3 py-2 rounded-lg border shadow-sm max-w-[180px] ${bgClass}`}
      >
        <div className="text-xs text-gray-800 truncate">{nodeData.label}</div>
        {nodeData.type && (
          <div className="text-[10px] text-gray-500 mt-0.5">{nodeData.type}</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-400" />
    </>
  );
}

export const GraphIdeaNode = memo(GraphIdeaNodeComponent);

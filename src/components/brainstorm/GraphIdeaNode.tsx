"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { IdeaType } from "@/lib/types";

export interface GraphIdeaNodeData {
  label: string;
  type: IdeaType | null;
  [key: string]: unknown;
}

function GraphIdeaNodeComponent({ data }: NodeProps) {
  const nodeData = data as GraphIdeaNodeData;
  const bgClass = "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600";

  return (
    <>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-gray-400" />
      <div className={`max-w-[180px] rounded-lg border px-3 py-2 shadow-sm ${bgClass}`}>
        <div className="truncate text-xs text-gray-800">{nodeData.label}</div>
        {nodeData.type && <div className="mt-0.5 text-[10px] text-gray-500">{nodeData.type}</div>}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-gray-400" />
    </>
  );
}

export const GraphIdeaNode = memo(GraphIdeaNodeComponent);

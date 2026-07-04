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

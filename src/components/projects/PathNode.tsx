"use client";

import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Check } from "lucide-react";

export const PathNode = memo(function PathNode({ data, id }: NodeProps) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      className={`min-w-[140px] rounded-xl border px-3 py-2 shadow-sm transition-colors ${
        data.isPromoted
          ? "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-100"
          : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      }`}
    >
      <Handle type="target" position={Position.Left} className="h-2 w-2 !bg-gray-400" />

      <div className="flex items-center gap-2" onDoubleClick={() => setEditing(true)}>
        {!!data.isPromoted && <Check size={12} className="text-violet-500" />}
        {editing ? (
          <input
            autoFocus
            defaultValue={String(data.title ?? "")}
            onBlur={(event) => {
              setEditing(false);
              window.dispatchEvent(
                new CustomEvent("path-node-title", {
                  detail: { id, title: event.currentTarget.value },
                }),
              );
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="nodrag w-full bg-transparent text-xs font-semibold outline-none"
          />
        ) : (
          <span className="truncate text-xs font-semibold">{String(data.title ?? "")}</span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="h-2 w-2 !bg-gray-400" />
    </div>
  );
});

"use client";

import { memo, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Check, Link2, StickyNote } from "lucide-react";
import type { PathFlowNode } from "./path/usePathGraph";

export const PathNode = memo(function PathNode({ data, id, selected }: NodeProps<PathFlowNode>) {
  const [editing, setEditing] = useState(false);
  const [linkedTaskHighlighted, setLinkedTaskHighlighted] = useState(false);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ ideaId: string | null }>).detail;
      setLinkedTaskHighlighted(Boolean(data.ideaId && detail?.ideaId === data.ideaId));
    };
    window.addEventListener("path-task-highlight", handler);
    return () => window.removeEventListener("path-task-highlight", handler);
  }, [data.ideaId]);
  return (
    <div
      className={`min-w-[160px] rounded-xl border px-3 py-2 shadow-sm transition-colors ${
        data.isCompleted
          ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-100"
          : data.isPromoted
            ? "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-100"
            : data.isLinked
              ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-100"
              : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      } ${
        selected || linkedTaskHighlighted
          ? "ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-gray-900"
          : ""
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="h-4 w-4 !border-2 !border-white !bg-violet-500 dark:!border-gray-900"
      />

      <div className="flex items-center gap-2" onDoubleClick={() => setEditing(true)}>
        {data.isLinked ? (
          <span
            aria-hidden="true"
            title={`${data.isCompleted ? "Completed" : data.isPromoted ? "Created task" : "Linked task"}${data.ideaStatus ? ` · ${String(data.ideaStatus).replaceAll("_", " ")}` : ""}`}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              data.isCompleted
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-violet-600 dark:text-violet-300"
            }`}
          >
            {data.isCompleted ? <Check size={13} /> : <Link2 size={13} />}
          </span>
        ) : (
          <button
            type="button"
            className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-violet-600 hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-violet-300 dark:hover:bg-violet-500/20"
            aria-label={`Mark ${String(data.title ?? "step")} ${data.isCompleted ? "not done" : "done"}`}
            title={data.isCompleted ? "Mark step not done" : "Mark step done"}
            onClick={(event) => {
              event.stopPropagation();
              window.dispatchEvent(
                new CustomEvent("path-step-completion", {
                  detail: { id, completed: !data.isCompleted },
                }),
              );
            }}
          >
            {data.isCompleted ? (
              <Check size={13} />
            ) : (
              <span className="h-2.5 w-2.5 rounded-full border border-current" aria-hidden="true" />
            )}
          </button>
        )}
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
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
            {String(data.title ?? "")}
          </span>
        )}
        {!editing && data.hasNotes && (
          <span
            title="Step has a note"
            aria-label="Step has a note"
            className="shrink-0 text-gray-500 dark:text-gray-400"
          >
            <StickyNote size={12} />
          </span>
        )}
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-1.5 pl-8">
        <span className="min-w-0 flex-1 truncate text-[10px] text-gray-500 dark:text-gray-400">
          {data.isLinked
            ? `${data.isPromoted ? "Created task" : "Linked task"} · ${String(data.ideaText ?? data.title ?? "Untitled task")}`
            : "Plan-only"}
        </span>
        <span
          aria-label={data.isCompleted ? "Completed" : "Not completed"}
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] leading-none font-semibold ${
            data.isCompleted
              ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100"
              : "bg-gray-200/80 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          {data.isCompleted
            ? "Completed"
            : data.isLinked && data.ideaStatus
              ? String(data.ideaStatus).replaceAll("_", " ")
              : "Not done"}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="h-4 w-4 !border-2 !border-white !bg-violet-500 dark:!border-gray-900"
      />
    </div>
  );
});

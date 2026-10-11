"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Idea, IdeaStatus, Tag } from "@/lib/types";
import { AREA_LABELS, STATUS_LABELS, STATUS_STYLES } from "@/lib/constants";
import { areaColors } from "@/styles/tokens";

export interface WorkflowTaskNodeData {
  idea: Idea;
  tags: Tag[];
  isProject?: boolean;
  /** Derived (never persisted): all depends_on prerequisites satisfied. */
  isReady?: boolean;
  /** Derived (never persisted): status is completed or cancelled. */
  isDone?: boolean;
  onUpdateStatus?: (id: string, status: IdeaStatus) => void;
  onOpenTask?: (id: string) => void;
  [key: string]: unknown;
}

export const NODE_WIDTH = 240;

function WorkflowTaskNodeComponent({ data, selected }: NodeProps) {
  const { idea, tags, isProject, isReady, isDone, onUpdateStatus, onOpenTask } =
    data as WorkflowTaskNodeData;
  const [expanded, setExpanded] = useState(false);
  const area = tags[0]?.area;

  if (isProject) {
    return (
      <>
        <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-violet-500" />
        <div
          className={`border-border w-[240px] rounded-xl border-2 bg-white/10 backdrop-blur-sm dark:border-gray-500/5 dark:bg-gray-900/10 ${selected ? "border-violet-500 ring-2 ring-violet-500/20" : "border-gray-200 dark:border-gray-700"}`}
        >
          <div className="text-[10px] font-bold tracking-wide text-violet-600 uppercase dark:text-violet-300">
            Project complete
          </div>
          <div className="mt-1 line-clamp-2 text-xs font-semibold text-gray-800 dark:text-gray-100">
            {idea.text || "Untitled project"}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-violet-500" />
      <div
        onClick={() => setExpanded((v) => !v)}
        className={`border-border w-[240px] cursor-pointer rounded-xl bg-white/10 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/10 ${selected ? "border-violet-500 ring-2 ring-violet-500/20" : isReady ? "border-emerald-400 ring-2 ring-emerald-500/20" : "border-gray-200 dark:border-gray-700"} ${isDone ? "opacity-60" : ""}`}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-xs font-semibold text-gray-800 dark:text-gray-100">
            {idea.text || "Untitled task"}
          </span>
          {isReady && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              Ready
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <select
            value={idea.status}
            onChange={(e) => onUpdateStatus?.(idea.id, e.target.value as IdeaStatus)}
            aria-label={`Status for ${idea.text || "untitled task"}`}
            className={`cursor-pointer rounded-full border px-2 py-0.5 text-[10px] font-medium outline-none ${STATUS_STYLES[idea.status] ?? "bg-gray-100 text-gray-600"}`}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {area && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: areaColors[area]?.bg, color: areaColors[area]?.text }}
            >
              {AREA_LABELS[area]}
            </span>
          )}
        </div>
        {(idea.scheduled_date || idea.scheduled_time) && (
          <div className="mt-2 text-[10px] text-gray-500">
            {idea.scheduled_date ?? ""}
            {idea.scheduled_time ? ` · ${idea.scheduled_time.slice(0, 5)}` : ""}
          </div>
        )}
        {expanded && (
          <div onClick={(e) => e.stopPropagation()}>
            <div className="mt-2 flex flex-wrap gap-1 border-t border-gray-100 pt-2 dark:border-gray-700">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] dark:bg-gray-700"
                >
                  {tag.name}
                </span>
              ))}
              {tags.length === 0 && <span className="text-[10px] text-gray-400">No area</span>}
            </div>
            {!idea.scheduled_date && !idea.scheduled_time && (
              <div className="mt-1 text-[10px] text-gray-400">Not scheduled</div>
            )}
            <button
              onClick={() => onOpenTask?.(idea.id)}
              className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Open task details
            </button>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-violet-500" />
    </>
  );
}

export const WorkflowTaskNode = memo(WorkflowTaskNodeComponent);

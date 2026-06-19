"use client";

import { useState } from "react";
import { Clock, X } from "lucide-react";
import { areaColors } from "@/styles/tokens";
import { Idea, LifeArea } from "@/lib/types";
import { AREA_ORDER, AREA_LABELS, SCHEDULE_HOURS } from "./constants";
import { formatTime } from "./plannerUtils";

interface ScheduleGridProps {
  activeDate: string;
  allTasks: Idea[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => void;
  onCreateTask: (text: string, time: string, area: LifeArea) => Promise<void>;
}

export function ScheduleGrid({ allTasks, onUpdateTask, onCreateTask }: ScheduleGridProps) {
  const [activeInputHour, setActiveInputHour] = useState<string | null>(null);
  const [dragOverHour, setDragOverHour] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [inputArea, setInputArea] = useState<LifeArea>("life");

  const scheduledTasks = allTasks.filter((t) => t.scheduled_time && t.status !== "archived");

  const handleCreate = async (hour: string) => {
    if (!inputText.trim()) return;
    await onCreateTask(inputText.trim(), hour, inputArea);
    setInputText("");
    setActiveInputHour(null);
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 flex flex-col h-[650px]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] flex-shrink-0">
        <Clock size={14} className="text-gray-400" />
        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Daily Timeline</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-black/[0.03] dark:divide-white/[0.03]">
        {SCHEDULE_HOURS.map((hour) => {
          const hourKey = hour.split(":")[0];
          const tasksInSlot = scheduledTasks.filter((t) => t.scheduled_time?.split(":")[0] === hourKey);
          const isActive = activeInputHour === hour;
          const isDragOver = dragOverHour === hour;

          return (
            <div
              key={hour}
              className={`flex items-start gap-3 px-4 py-2.5 group transition-colors duration-150 relative ${
                isDragOver ? "bg-violet-500/10 border-y border-dashed border-violet-500/30" : ""
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOverHour(hour); }}
              onDragLeave={() => setDragOverHour(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverHour(null);
                const taskId = e.dataTransfer.getData("text/plain");
                if (taskId) onUpdateTask(taskId, { scheduled_time: hour });
              }}
            >
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 w-10 pt-1.5 tabular-nums flex-shrink-0">
                {formatTime(hour)}
              </span>

              <div className="flex-1 space-y-1.5 min-w-0">
                {tasksInSlot.map((task) => {
                  const isLong = task.duration_minutes && task.duration_minutes >= 60;
                  const heightVal = task.duration_minutes
                    ? Math.max(38, Math.min(240, (task.duration_minutes / 60) * 64))
                    : 38;

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", task.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      style={{ minHeight: `${heightVal}px` }}
                      className={`flex ${
                        isLong ? "flex-col justify-between items-stretch" : "items-center gap-2"
                      } text-xs cursor-grab active:cursor-grabbing hover:bg-black/5 dark:hover:bg-white/5 rounded-xl p-2 -mx-1 border border-black/[0.02] dark:border-white/[0.02] bg-white/40 dark:bg-white/[0.01] transition-all group`}
                    >
                      {isLong ? (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <span className={`font-semibold text-[11px] leading-snug break-words ${
                              task.done_at ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-200"
                            }`}>
                              {task.text}
                            </span>
                            <button
                              onClick={() => onUpdateTask(task.id, { scheduled_time: null })}
                              className="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Unschedule task"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-black/[0.03] dark:border-white/[0.03]">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: areaColors[task.area ?? "life"]?.dot }} />
                              <span className="text-[9px] font-bold text-gray-400 capitalize">{task.area ?? "life"}</span>
                            </div>
                            <span className="text-[9px] bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded text-gray-400 dark:text-gray-500 font-bold tabular-nums">
                              {task.duration_minutes}m
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: areaColors[task.area ?? "life"]?.dot }} />
                          <span className={`flex-1 truncate font-medium text-[11px] ${
                            task.done_at ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-200"
                          }`}>
                            {task.text}
                          </span>
                          {task.duration_minutes && (
                            <span className="text-[9px] bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded text-gray-400 dark:text-gray-500 font-bold tabular-nums flex-shrink-0">
                              {task.duration_minutes}m
                            </span>
                          )}
                          <button
                            onClick={() => onUpdateTask(task.id, { scheduled_time: null })}
                            className="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Unschedule task"
                          >
                            <X size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}

                {isActive ? (
                  <div className="flex flex-col gap-1.5 bg-black/[0.02] dark:bg-white/[0.02] p-2 rounded-xl border border-black/5 dark:border-white/5 mt-1">
                    <input
                      type="text"
                      placeholder="Add task to this hour..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleCreate(hour);
                        if (e.key === "Escape") setActiveInputHour(null);
                      }}
                      className="w-full bg-white/80 dark:bg-gray-800/80 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 text-gray-800 dark:text-gray-200"
                      autoFocus
                    />
                    <div className="flex justify-between items-center gap-2">
                      <select
                        value={inputArea}
                        onChange={(e) => setInputArea(e.target.value as LifeArea)}
                        className="bg-white/80 dark:bg-gray-800/80 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-[10px] text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      >
                        {AREA_ORDER.map((a) => (
                          <option key={a} value={a}>{AREA_LABELS[a]}</option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        <button onClick={() => setActiveInputHour(null)} className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1 cursor-pointer">
                          Cancel
                        </button>
                        <button onClick={() => void handleCreate(hour)} className="text-[10px] bg-violet-600 text-white px-2.5 py-1 rounded-lg hover:bg-violet-700 font-bold cursor-pointer">
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setActiveInputHour(hour); setInputText(""); }}
                    className="w-full text-left text-[10px] text-gray-300 dark:text-gray-600 hover:text-violet-500 dark:hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100 py-1 cursor-pointer font-semibold"
                  >
                    + Schedule at {formatTime(hour)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

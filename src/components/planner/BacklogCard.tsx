"use client";

import { useState } from "react";
import { Inbox, Plus, ChevronRight } from "lucide-react";
import { Idea, Tag } from "@/lib/types";
import { AREA_DOT_COLORS } from "@/components/shared/TagPicker";
import { formatDayLabel } from "./plannerUtils";

interface BacklogCardProps {
  tasks: Idea[];
  activeDate: string;
  today: string;
  onScheduleToDate: (id: string) => Promise<void>;
  onCreateInboxTask: (text: string) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
}

export function BacklogCard({ tasks, activeDate, today, onScheduleToDate, onCreateInboxTask, getTagsForIdea }: BacklogCardProps) {
  const [inputText, setInputText] = useState("");
  const dateLabel = formatDayLabel(activeDate, today);

  return (
    <div className="glass-card rounded-2xl flex flex-col h-[650px] overflow-hidden border border-black/5 dark:border-white/5">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] flex-shrink-0">
        <h2 className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <Inbox size={14} className="text-gray-400" /> Backlog Inbox
          <span className="text-[10px] font-bold bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </h2>
      </div>

      <div className="px-4 py-2 border-b border-black/5 dark:border-white/5 flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl px-2.5 py-1">
          <Plus size={13} className="text-gray-400" />
          <input
            type="text"
            placeholder="Add task to backlog..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && inputText.trim()) {
                await onCreateInboxTask(inputText.trim());
                setInputText("");
              }
            }}
            className="flex-1 bg-transparent border-none text-xs focus:ring-0 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-700 dark:text-gray-200 outline-none py-0.5 font-medium"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {tasks.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500 italic">
            <Inbox size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2 opacity-50" />
            <p className="text-xs font-semibold">Your backlog is clean!</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", task.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="bg-white/60 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing hover:border-violet-500/30 hover:bg-white dark:hover:bg-white/[0.04] transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-gray-700 dark:text-gray-200 font-semibold leading-snug flex-1">
                  {task.text}
                </span>
                <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                  {getTagsForIdea(task.id).map((tag) => (
                    <span key={tag.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${AREA_DOT_COLORS[tag.area]}`} />
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onScheduleToDate(task.id)}
                className="self-end text-[10px] text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-0.5 hover:text-violet-700 cursor-pointer"
              >
                Schedule to {dateLabel} <ChevronRight size={10} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

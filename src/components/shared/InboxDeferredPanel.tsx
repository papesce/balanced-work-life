"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Inbox, Clock, ChevronRight, Plus, Check, ExternalLink } from "lucide-react";
import { Idea, Tag } from "@/lib/types";
import { RescheduleAction, getContextDate } from "@/lib/tasks/rescheduleTask";
import { AgeBucket } from "@/hooks/useDeferredTasks";
import { AREA_DOT_COLORS } from "@/components/shared/TagPicker";

interface InboxDeferredPanelProps {
  compact?: boolean;
  activeDate: string;
  today: string;
  inboxTasks: Idea[];
  onCreateInboxTask: (text: string) => Promise<void>;
  onScheduleToDate: (id: string) => Promise<void>;
  overdueBuckets: AgeBucket[];
  deferredTasks: Idea[];
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
}

export function InboxDeferredPanel({
  compact = false,
  activeDate,
  today,
  inboxTasks,
  onCreateInboxTask,
  onScheduleToDate,
  overdueBuckets,
  deferredTasks,
  onReschedule,
  onComplete,
  getTagsForIdea,
}: InboxDeferredPanelProps) {
  const [activeTab, setActiveTab] = useState<"inbox" | "deferred">("inbox");
  const [inputText, setInputText] = useState("");

  const totalDeferred = useMemo(
    () => overdueBuckets.reduce((sum, b) => sum + b.tasks.length, 0) + deferredTasks.length,
    [overdueBuckets, deferredTasks],
  );

  return (
    <div className="glass-card rounded-2xl flex flex-col h-[650px] overflow-hidden border border-black/5 dark:border-white/5">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] flex-shrink-0">
        {[
          { id: "inbox" as const, label: "Inbox", icon: Inbox, count: inboxTasks.length },
          { id: "deferred" as const, label: "Deferred", icon: Clock, count: totalDeferred },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-white dark:bg-gray-800 shadow-sm text-violet-600 dark:text-violet-400 font-bold"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="text-[10px] font-bold bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "inbox" ? (
        <InboxTab
          tasks={inboxTasks}
          activeDate={activeDate}
          inputText={inputText}
          setInputText={setInputText}
          onCreateInboxTask={onCreateInboxTask}
          onScheduleToDate={onScheduleToDate}
          getTagsForIdea={getTagsForIdea}
        />
      ) : (
        <DeferredTab
          compact={compact}
          overdueBuckets={overdueBuckets}
          deferredTasks={deferredTasks}
          today={today}
          onReschedule={onReschedule}
          onComplete={onComplete}
          getTagsForIdea={getTagsForIdea}
        />
      )}
    </div>
  );
}

function InboxTab({
  tasks,
  activeDate,
  inputText,
  setInputText,
  onCreateInboxTask,
  onScheduleToDate,
  getTagsForIdea,
}: {
  tasks: Idea[];
  activeDate: string;
  inputText: string;
  setInputText: (v: string) => void;
  onCreateInboxTask: (text: string) => Promise<void>;
  onScheduleToDate: (id: string) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
}) {
  return (
    <>
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
                Schedule to today <ChevronRight size={10} />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function DeferredTab({
  compact,
  overdueBuckets,
  deferredTasks,
  today,
  onReschedule,
  onComplete,
  getTagsForIdea,
}: {
  compact: boolean;
  overdueBuckets: AgeBucket[];
  deferredTasks: Idea[];
  today: string;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
}) {
  const allTasks = useMemo(() => {
    if (compact) {
      const flat: { task: Idea; ageLabel: string }[] = [];
      for (const bucket of overdueBuckets) {
        for (const task of bucket.tasks) flat.push({ task, ageLabel: bucket.label });
      }
      for (const task of deferredTasks) flat.push({ task, ageLabel: "Deferred" });
      return flat;
    }
    return null;
  }, [compact, overdueBuckets, deferredTasks]);

  const hasAny = overdueBuckets.some((b) => b.tasks.length > 0) || deferredTasks.length > 0;

  if (!hasAny) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-gray-400 dark:text-gray-500 italic text-xs">
        No deferred tasks
      </div>
    );
  }

  if (compact && allTasks) {
    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {allTasks.map(({ task, ageLabel }) => (
          <CompactDeferredRow
            key={task.id}
            task={task}
            ageLabel={ageLabel}
            today={today}
            onReschedule={onReschedule}
            onComplete={onComplete}
            getTagsForIdea={getTagsForIdea}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {overdueBuckets.map((bucket) => (
        <div key={bucket.label}>
          <div className="flex items-center gap-2 px-1 mb-1.5">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {bucket.label}
            </span>
            <span className="text-[9px] font-bold bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
              {bucket.tasks.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {bucket.tasks.map((task) => (
              <CompactDeferredRow
                key={task.id}
                task={task}
                ageLabel=""
                today={today}
                onReschedule={onReschedule}
                onComplete={onComplete}
                getTagsForIdea={getTagsForIdea}
              />
            ))}
          </div>
        </div>
      ))}

      {deferredTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-1 mb-1.5">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Deferred
            </span>
            <span className="text-[9px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
              {deferredTasks.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {deferredTasks.map((task) => (
              <CompactDeferredRow
                key={task.id}
                task={task}
                ageLabel=""
                today={today}
                onReschedule={onReschedule}
                onComplete={onComplete}
                getTagsForIdea={getTagsForIdea}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompactDeferredRow({
  task,
  ageLabel,
  today,
  onReschedule,
  onComplete,
  getTagsForIdea,
}: {
  task: Idea;
  ageLabel: string;
  today: string;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
}) {
  const tags = getTagsForIdea(task.id);

  return (
    <div className="bg-white/60 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-2.5 flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] text-gray-700 dark:text-gray-200 font-semibold leading-snug flex-1">
          {task.text}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {ageLabel && (
            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500">
              {ageLabel}
            </span>
          )}
          {task.attempt_dates.length > 0 && (
            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500">
              {task.attempt_dates.length}x
            </span>
          )}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {tags.map((tag) => (
            <span key={tag.id} className="text-[8px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${AREA_DOT_COLORS[tag.area]}`} />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 self-end">
        <button
          onClick={() => void onComplete(task.id)}
          className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 px-1.5 py-0.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer flex items-center gap-0.5"
        >
          <Check size={10} />
          Completar
        </button>
        <Link
          href={`/?date=${getContextDate(task)}&highlight=${task.id}`}
          className="text-[9px] font-bold text-gray-400 dark:text-gray-500 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors flex items-center gap-0.5"
        >
          <ExternalLink size={9} />
          Contexto
        </Link>
        <button
          onClick={() => void onReschedule(task.id, { type: "retry_today" })}
          className="text-[9px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 px-1.5 py-0.5 rounded hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors cursor-pointer"
        >
          Hoy
        </button>
        <div className="relative group/date">
          <button className="text-[9px] font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 px-1.5 py-0.5 rounded hover:bg-sky-50 dark:hover:bg-sky-950/20 transition-colors cursor-pointer">
            Reprogramar
          </button>
          <input
            type="date"
            className="absolute right-0 top-full mt-1 opacity-0 w-0 h-0 pointer-events-none group-hover/date:opacity-100 group-hover/date:w-auto group-hover/date:h-auto group-hover/date:pointer-events-auto text-xs border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500 z-50"
            onChange={(e) => {
              if (e.target.value) void onReschedule(task.id, { type: "reschedule", newDate: e.target.value });
            }}
          />
        </div>
        <button
          onClick={() => void onReschedule(task.id, { type: "defer" })}
          className="text-[9px] font-bold text-gray-400 dark:text-gray-500 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors cursor-pointer"
        >
          Sin fecha
        </button>
      </div>
    </div>
  );
}

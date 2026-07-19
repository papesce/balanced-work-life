"use client";

import { useMemo, useCallback, useState } from "react";
import Link from "next/link";
import { Clock, ChevronRight, Calendar, History, Check, ExternalLink } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { useDeferredTasks, AgeBucket } from "@/hooks/useDeferredTasks";
import { AppShell } from "@/components/AppShell";
import { Idea, Tag, getAreasForIdea } from "@/lib/types";
import { computeReschedulePatch, computeCompletePatch, getContextDate, RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { AREA_DOT_COLORS } from "@/components/shared/TagPicker";
import { getToday } from "@/lib/dateUtils";

export default function DeferredPage() {
  const { ideas, updateIdea } = useIdeas();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const { overdueBuckets, deferredTasks, loading } = useDeferredTasks();
  const today = getToday();

  const handleReschedule = useCallback(async (id: string, action: RescheduleAction) => {
    const idea = ideas.find((i) => i.id === id);
    if (!idea) return;
    const patch = computeReschedulePatch(idea, action);
    await updateIdea(id, patch);
  }, [ideas, updateIdea]);

  const handleComplete = useCallback(async (id: string) => {
    const patch = computeCompletePatch();
    await updateIdea(id, patch);
  }, [updateIdea]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading deferred tasks...</div>
      </div>
    );
  }

  const hasAny = overdueBuckets.some((b) => b.tasks.length > 0) || deferredTasks.length > 0;

  return (
    <AppShell title="Deferred Tasks">
      <div className="space-y-6">
        {!hasAny ? (
          <div className="glass-card rounded-2xl text-center py-20 text-gray-400 dark:text-gray-500 border border-dashed border-black/5 dark:border-white/5">
            <Clock size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3 opacity-60" />
            <p className="text-sm font-semibold mb-1">No deferred tasks</p>
            <p className="text-xs">Tasks that miss their scheduled date will appear here.</p>
          </div>
        ) : (
          <>
            {overdueBuckets.map((bucket) => (
              <BucketSection
                key={bucket.label}
                bucket={bucket}
                today={today}
                onReschedule={handleReschedule}
                onComplete={handleComplete}
                getTagsForIdea={taskTagsHook.getTagsForIdea}
              />
            ))}

            {deferredTasks.length > 0 && (
              <DeferredSection
                tasks={deferredTasks}
                today={today}
                onReschedule={handleReschedule}
                onComplete={handleComplete}
                getTagsForIdea={taskTagsHook.getTagsForIdea}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function BucketSection({
  bucket,
  today,
  onReschedule,
  onComplete,
  getTagsForIdea,
}: {
  bucket: AgeBucket;
  today: string;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
}) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-black/5 dark:border-white/5">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
        <h2 className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <Calendar size={13} className="text-gray-400" />
          {bucket.label}
          <span className="text-[10px] font-bold bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
            {bucket.tasks.length}
          </span>
        </h2>
      </div>
      <div className="p-3 space-y-2">
        {bucket.tasks.map((task) => (
          <DeferredTaskRow
            key={task.id}
            task={task}
            today={today}
            onReschedule={onReschedule}
            onComplete={onComplete}
            getTagsForIdea={getTagsForIdea}
          />
        ))}
      </div>
    </div>
  );
}

function DeferredSection({
  tasks,
  today,
  onReschedule,
  onComplete,
  getTagsForIdea,
}: {
  tasks: Idea[];
  today: string;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-black/5 dark:border-white/5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <h2 className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <History size={13} className="text-amber-500" />
          Deferred (no date)
          <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </h2>
        <ChevronRight
          size={14}
          className={`text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <div className="p-3 space-y-2">
          {tasks.map((task) => (
            <DeferredTaskRow
              key={task.id}
              task={task}
              today={today}
              onReschedule={onReschedule}
              onComplete={onComplete}
              getTagsForIdea={getTagsForIdea}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeferredTaskRow({
  task,
  today,
  onReschedule,
  onComplete,
  getTagsForIdea,
}: {
  task: Idea;
  today: string;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
}) {
  const tags = getTagsForIdea(task.id);

  return (
    <div className="bg-white/60 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-gray-700 dark:text-gray-200 font-semibold leading-snug flex-1">
          {task.text}
        </span>
        {task.attempt_dates.length > 0 && (
          <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 flex-shrink-0">
            {task.attempt_dates.length} attempt{task.attempt_dates.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {tags.map((tag) => (
            <span key={tag.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${AREA_DOT_COLORS[tag.area]}`} />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 self-end">
        <button
          onClick={() => void onComplete(task.id)}
          className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer flex items-center gap-1"
        >
          <Check size={11} />
          Completar
        </button>
        <Link
          href={`/?date=${getContextDate(task)}&highlight=${task.id}`}
          className="text-[10px] font-bold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors flex items-center gap-1"
        >
          <ExternalLink size={10} />
          Ver contexto
        </Link>
        <button
          onClick={() => void onReschedule(task.id, { type: "retry_today" })}
          className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors cursor-pointer"
        >
          Intentar hoy
        </button>
        <div className="relative group/date">
          <button className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 px-2 py-1 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/20 transition-colors cursor-pointer">
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
          className="text-[10px] font-bold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors cursor-pointer"
        >
          Dejar sin fecha
        </button>
      </div>
    </div>
  );
}

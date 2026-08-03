"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Clock, ChevronRight, Calendar, History, ExternalLink } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useTaskTags } from "@/hooks/useTaskTags";
import { useDeferredTasks, AgeBucket } from "@/hooks/useDeferredTasks";
import { AppShell } from "@/components/AppShell";
import { Idea, Tag } from "@/lib/types";
import { computeReschedulePatch, computeCompletePatch, computeCancelPatch, getContextDate, getTriageMeta, RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { useUndoAction } from "@/lib/tasks/undo";
import { UndoBar } from "@/components/shared/UndoBar";
import { TriageActions } from "@/components/triage/TriageActions";
import { AREA_DOT_COLORS } from "@/components/shared/TagPicker";
import { formatDate } from "@/lib/dateUtils";

export default function DeferredPage() {
  const { ideas, updateIdea } = useIdeas();
  const taskTagsHook = useTaskTags();
  const { overdueBuckets, deferredTasks, loading } = useDeferredTasks();
  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();

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

  const handleCancel = useCallback(async (id: string) => {
    const idea = ideas.find((i) => i.id === id);
    if (!idea) return;
    const previous = idea;
    const patch = computeCancelPatch();
    await updateIdea(id, patch);
    registerUndo({
      label: "Task cancelled",
      run: async () => {
        await updateIdea(id, { status: previous.status, cancelled_at: null });
      },
    });
  }, [ideas, updateIdea, registerUndo]);

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
        <UndoBar undoAction={undoAction} onUndo={() => void handleUndo()} onDismiss={clearUndo} />
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
                onReschedule={handleReschedule}
                onComplete={handleComplete}
                onCancel={handleCancel}
                getTagsForIdea={taskTagsHook.getTagsForIdea}
              />
            ))}

            {deferredTasks.length > 0 && (
              <DeferredSection
                tasks={deferredTasks}
                onReschedule={handleReschedule}
                onComplete={handleComplete}
                onCancel={handleCancel}
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
  onReschedule,
  onComplete,
  onCancel,
  getTagsForIdea,
}: {
  bucket: AgeBucket;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
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
            onReschedule={onReschedule}
            onComplete={onComplete}
            onCancel={onCancel}
            getTagsForIdea={getTagsForIdea}
          />
        ))}
      </div>
    </div>
  );
}

function DeferredSection({
  tasks,
  onReschedule,
  onComplete,
  onCancel,
  getTagsForIdea,
}: {
  tasks: Idea[];
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
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
              onReschedule={onReschedule}
              onComplete={onComplete}
              onCancel={onCancel}
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
  onReschedule,
  onComplete,
  onCancel,
  getTagsForIdea,
}: {
  task: Idea;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
}) {
  const tags = getTagsForIdea(task.id);
  const meta = getTriageMeta(task);

  return (
    <div className="bg-white/60 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-gray-700 dark:text-gray-200 font-semibold leading-snug flex-1">
          {task.text}
        </span>
        {meta.attemptCount > 0 && (
          <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 flex-shrink-0">
            {meta.attemptCount} attempt{meta.attemptCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
        {meta.originalDate && (
          <span>
            <span className="font-semibold text-gray-500 dark:text-gray-400">Original:</span> {formatDate(meta.originalDate)}
          </span>
        )}
        {task.scheduled_date && (
          <span>
            <span className="font-semibold text-gray-500 dark:text-gray-400">Current:</span> {formatDate(task.scheduled_date)}
          </span>
        )}
        {!task.scheduled_date && <span>{meta.movedToLabel}</span>}
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

      <div className="flex items-center gap-2 self-end flex-wrap">
        <Link
          href={`/?date=${getContextDate(task)}&highlight=${task.id}`}
          className="text-[10px] font-bold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors flex items-center gap-1"
        >
          <ExternalLink size={10} />
          Context
        </Link>
        <TriageActions
          task={task}
          onReschedule={onReschedule}
          onComplete={onComplete}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}

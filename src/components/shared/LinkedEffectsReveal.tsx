"use client";

import { useRouter } from "next/navigation";
import { Clock, Link2, ArrowRight, ExternalLink } from "lucide-react";
import { CompletionEffects, LinkEffect } from "@/lib/linkEffects";
import { Idea } from "@/lib/types";
import { getRevealHref } from "@/lib/reveal";

function scheduleLabel(idea: Idea): string | null {
  if (!idea.scheduled_date) return null;
  if (idea.scheduled_time) return `${idea.scheduled_date} · ${idea.scheduled_time.slice(0, 5)}`;
  return idea.scheduled_date;
}

function EffectRow({
  effect,
  onNavigate,
}: {
  effect: LinkEffect;
  onNavigate: (idea: Idea) => void;
}) {
  const { linkedIdea, label } = effect;
  const sched = scheduleLabel(linkedIdea);
  return (
    <button
      onClick={() => onNavigate(linkedIdea)}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-black/5 bg-white/60 px-2.5 py-2 text-left hover:border-violet-200 hover:bg-violet-50/50 dark:border-white/5 dark:bg-white/[0.03] dark:hover:border-violet-800/50 dark:hover:bg-violet-950/20"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
          {linkedIdea.text || "Untitled"}
        </p>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-px text-[10px] font-medium text-violet-700 dark:border-violet-800/50 dark:bg-violet-900/30 dark:text-violet-300">
            <Link2 size={10} /> {label}
          </span>
          {sched && (
            <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-1.5 py-px text-[10px] text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
              <Clock size={10} /> {sched}
            </span>
          )}
          <span className="text-[10px] text-gray-400 capitalize dark:text-gray-500">
            {linkedIdea.status.replace("_", " ")}
          </span>
        </span>
      </div>
      <ArrowRight size={12} className="shrink-0 text-gray-300 dark:text-gray-600" />
    </button>
  );
}

function Section({
  title,
  effects,
  onNavigate,
  accent,
}: {
  title: string;
  effects: LinkEffect[];
  onNavigate: (idea: Idea) => void;
  accent?: string;
}) {
  if (effects.length === 0) return null;
  return (
    <div>
      <p
        className={`mb-1.5 text-[10px] font-bold tracking-wider uppercase ${accent ?? "text-gray-500 dark:text-gray-400"}`}
      >
        {title} · {effects.length}
      </p>
      <div className="space-y-1.5">
        {effects.map((e) => (
          <EffectRow key={e.link.id} effect={e} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export function LinkedEffectsReveal({
  effects,
  completedText,
  onClose,
  onNavigate,
}: {
  effects: CompletionEffects;
  completedText: string;
  onClose: () => void;
  onNavigate?: (idea: Idea) => void;
}) {
  const router = useRouter();
  const navigate = (idea: Idea) => {
    if (onNavigate) {
      onNavigate(idea);
      return;
    }
    const url = getRevealHref("brainstorm", idea);
    router.push(url);
  };

  const total =
    effects.unlocked.length +
    effects.contributes.length +
    effects.related.length +
    effects.blockedBy.length;
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-violet-200/40 bg-violet-50/40 p-3 dark:border-violet-800/30 dark:bg-violet-950/15">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
          Completed &ldquo;{completedText || "Untitled"}&rdquo;
          {effects.unlocked.length > 0 && ` · unlocked ${effects.unlocked.length}`}
        </p>
        <button
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-[11px] font-medium text-violet-600 hover:bg-violet-100 dark:text-violet-400 dark:hover:bg-violet-900/30"
        >
          Dismiss
        </button>
      </div>

      <div className="space-y-3">
        {effects.unlocked.length > 0 && (
          <Section
            title="Unlocked — ready to do next"
            effects={effects.unlocked}
            onNavigate={navigate}
            accent="text-emerald-600 dark:text-emerald-400"
          />
        )}
        {effects.contributes.length > 0 && (
          <Section
            title="Contributes to"
            effects={effects.contributes}
            onNavigate={navigate}
            accent="text-blue-600 dark:text-blue-400"
          />
        )}
        {effects.blockedBy.length > 0 && (
          <Section
            title="Was waiting on — now completed despite"
            effects={effects.blockedBy}
            onNavigate={navigate}
            accent="text-amber-600 dark:text-amber-400"
          />
        )}
        {effects.related.length > 0 && (
          <Section title="Related" effects={effects.related} onNavigate={navigate} />
        )}
      </div>

      <p className="mt-2 flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
        <ExternalLink size={10} /> Tap a task to open it · navigation only
      </p>
    </div>
  );
}

/** Compact inline badge for use inside UndoBar / toast */
export function LinkedEffectsBadge({ effects }: { effects: CompletionEffects }) {
  const n = effects.unlocked.length;
  if (n === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      <Link2 size={10} /> Unlocked {n}
    </span>
  );
}

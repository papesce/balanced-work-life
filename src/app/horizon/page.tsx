"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { AppShell } from "@/components/AppShell";
import { QuickAddInput } from "@/components/timeline/QuickAddInput";
import { Idea, IdeaHorizon } from "@/lib/types";

const HORIZONS: { key: IdeaHorizon; label: string }[] = [
  { key: "short", label: "Short term" },
  { key: "medium", label: "Medium term" },
  { key: "long", label: "Long term" },
];

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  project: {
    label: "Project",
    className: "bg-blue-100/80 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  initiative: {
    label: "Initiative",
    className: "bg-violet-100/80 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  },
  task: {
    label: "Task",
    className: "bg-gray-100/80 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400",
  },
};

function HorizonColumn({
  label,
  items,
  parentMap,
  onAdd,
  onItemPress,
}: {
  label: string;
  items: Idea[];
  parentMap: Map<string, Idea>;
  onAdd: (text: string) => Promise<void>;
  onItemPress: (idea: Idea) => void;
}) {
  return (
    <div className="glass-card flex min-w-0 flex-1 flex-col rounded-2xl">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/5">
        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{label}</span>
        <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-gray-400 dark:bg-white/[0.06] dark:text-gray-500">
          {items.length}
        </span>
      </div>

      <div className="max-h-[calc(100vh-220px)] min-h-[120px] flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-gray-400 italic dark:text-gray-500">
            No items yet
          </p>
        ) : (
          <div className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
            {items.map((item) => {
              const badge = item.type ? TYPE_BADGE[item.type] : null;
              const parent = item.parent_id ? parentMap.get(item.parent_id) : null;

              return (
                <button
                  key={item.id}
                  onClick={() => onItemPress(item)}
                  className="group flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log("Toggle priority:", item.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        console.log("Toggle priority:", item.id);
                      }
                    }}
                    className="flex-shrink-0 cursor-pointer"
                  >
                    <Star
                      size={13}
                      className={
                        item.is_priority
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300 group-hover:text-gray-400 dark:text-gray-600 dark:group-hover:text-gray-500"
                      }
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-800 dark:text-gray-200">
                      {item.text || "Untitled"}
                    </span>
                    {(badge || parent) && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {badge && (
                          <span
                            className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        )}
                        {parent && (
                          <span className="truncate text-[10px] text-gray-400 dark:text-gray-500">
                            {parent.text || "Untitled parent"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-black/[0.02] px-4 py-2 dark:border-white/[0.02]">
        <QuickAddInput placeholder={`+ Add to ${label.toLowerCase()}...`} onAdd={onAdd} />
      </div>
    </div>
  );
}

export default function HorizonPage() {
  const { ideas, loading, createIdea } = useIdeas();
  const [activeTab, setActiveTab] = useState<IdeaHorizon>("short");

  const parentMap = useMemo(() => {
    const map = new Map<string, Idea>();
    for (const idea of ideas) map.set(idea.id, idea);
    return map;
  }, [ideas]);

  const activeIdeas = useMemo(
    () =>
      ideas.filter(
        (i) =>
          i.horizon != null &&
          (i.status === "inbox" ||
            i.status === "draft" ||
            i.status === "planned" ||
            i.status === "in_progress" ||
            i.status === "scheduled") &&
          i.parent_id == null,
      ),
    [ideas],
  );

  const ideasByHorizon = useMemo(() => {
    const grouped: Record<IdeaHorizon, Idea[]> = { short: [], medium: [], long: [] };
    for (const idea of activeIdeas) {
      if (idea.horizon && grouped[idea.horizon]) {
        grouped[idea.horizon].push(idea);
      }
    }
    for (const key of Object.keys(grouped) as IdeaHorizon[]) {
      grouped[key].sort((a, b) => {
        const aPriority = a.priority_order ?? Infinity;
        const bPriority = b.priority_order ?? Infinity;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.sort_order - b.sort_order;
      });
    }
    return grouped;
  }, [activeIdeas]);

  const handleAdd = (horizon: IdeaHorizon) => {
    return async (text: string): Promise<void> => {
      await createIdea(text, null, "bottom", {
        type: "task",
        status: "inbox",
        horizon,
      });
    };
  };

  const handleItemPress = (idea: Idea) => {
    console.log("Navigate to detail:", idea.id, idea.text);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading horizon...</div>
      </div>
    );
  }

  return (
    <AppShell title="Horizon" fullWidth>
      {/* Mobile tab bar */}
      <div className="sticky top-[53px] z-10 mb-4 flex gap-1 rounded-xl bg-black/[0.03] p-1 md:hidden dark:bg-white/[0.04]">
        {HORIZONS.map((h) => (
          <button
            key={h.key}
            onClick={() => setActiveTab(h.key)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeTab === h.key
                ? "bg-violet-100/80 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>

      {/* Desktop: three columns stacked vertically */}
      <div className="hidden gap-5 md:flex md:flex-col">
        {HORIZONS.map((h, i) => (
          <motion.div
            key={h.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: "easeOut" }}
            className="min-w-0"
          >
            <HorizonColumn
              label={h.label}
              items={ideasByHorizon[h.key]}
              parentMap={parentMap}
              onAdd={handleAdd(h.key)}
              onItemPress={handleItemPress}
            />
          </motion.div>
        ))}
      </div>

      {/* Mobile: single column with animated tab switch */}
      <div className="md:hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            <HorizonColumn
              label={HORIZONS.find((h) => h.key === activeTab)!.label}
              items={ideasByHorizon[activeTab]}
              parentMap={parentMap}
              onAdd={handleAdd(activeTab)}
              onItemPress={handleItemPress}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

"use client";

import { ArrowRight, Compass, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

interface EmptyDayForkProps {
  missedCount: number;
  onCatchUp: () => void;
  onPickFresh: () => void;
}

export function EmptyDayFork({ missedCount, onCatchUp, onPickFresh }: EmptyDayForkProps) {
  const pickFreshIsPrimary = missedCount === 0;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="glass-card rounded-2xl border border-black/5 p-5 dark:border-white/5"
    >
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
        Nothing planned yet. How do you want to start?
      </h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {missedCount > 0 && (
          <button
            type="button"
            onClick={onCatchUp}
            className="group flex min-h-20 cursor-pointer items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-left transition-colors hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:border-violet-400/20 dark:bg-violet-950/30 dark:hover:bg-violet-950/50"
          >
            <span className="flex items-center gap-3">
              <RotateCcw size={18} className="shrink-0 text-violet-600 dark:text-violet-400" />
              <span>
                <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">
                  Catch up
                </span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                  {missedCount} missed
                </span>
              </span>
            </span>
            <ArrowRight
              size={16}
              className="shrink-0 text-violet-500 transition-transform group-hover:translate-x-0.5 dark:text-violet-400"
            />
          </button>
        )}
        <button
          type="button"
          onClick={onPickFresh}
          className={`group flex min-h-20 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 ${
            pickFreshIsPrimary
              ? "border-violet-600 bg-violet-600 hover:bg-violet-700 dark:border-violet-500 dark:bg-violet-500 dark:hover:bg-violet-600"
              : "border-black/5 bg-white/70 hover:bg-black/[0.03] dark:border-white/10 dark:bg-gray-900/50 dark:hover:bg-white/[0.05]"
          }`}
        >
          <span className="flex items-center gap-3">
            <Compass
              size={18}
              className={`shrink-0 ${pickFreshIsPrimary ? "text-white" : "text-violet-600 dark:text-violet-400"}`}
            />
            <span>
              <span
                className={`block text-sm font-bold ${pickFreshIsPrimary ? "text-white" : "text-gray-800 dark:text-gray-100"}`}
              >
                Pick fresh
              </span>
              <span
                className={`mt-0.5 block text-xs ${pickFreshIsPrimary ? "text-violet-100" : "text-gray-500 dark:text-gray-400"}`}
              >
                Choose what matters now
              </span>
            </span>
          </span>
          <ArrowRight
            size={16}
            className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${pickFreshIsPrimary ? "text-white" : "text-gray-400 dark:text-gray-500"}`}
          />
        </button>
      </div>
    </motion.section>
  );
}

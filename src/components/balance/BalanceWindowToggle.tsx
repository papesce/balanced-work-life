"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WindowType, getWindowLabel, offsetWindow } from "@/lib/dateUtils";

const TABS: { key: WindowType; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

interface BalanceWindowToggleProps {
  window: WindowType;
  referenceDate: string;
  onChange: (window: WindowType, referenceDate: string) => void;
}

export function BalanceWindowToggle({ window, referenceDate, onChange }: BalanceWindowToggleProps) {
  const label = getWindowLabel(window, referenceDate);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Tab pills */}
      <div className="flex rounded-xl bg-black/5 dark:bg-white/5 p-1 gap-0.5">
        {TABS.map((tab) => {
          const active = tab.key === window;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key, referenceDate)}
              className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "text-violet-700 dark:text-violet-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="balance-tab-bg"
                  className="absolute inset-0 rounded-lg bg-white dark:bg-white/10 shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(window, offsetWindow(window, referenceDate, -1))}
          className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft size={16} />
        </button>

        <AnimatePresence mode="wait">
          <motion.span
            key={`${window}-${referenceDate}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[160px] text-center"
          >
            {label}
          </motion.span>
        </AnimatePresence>

        <button
          onClick={() => onChange(window, offsetWindow(window, referenceDate, 1))}
          className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label="Next"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

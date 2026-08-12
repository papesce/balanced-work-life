"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WindowType, getWindowLabel, offsetWindow, toLocalDateString } from "@/lib/dateUtils";
import { MonthYearPicker } from "./MonthYearPicker";
import { YearPicker } from "./YearPicker";

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
  const isDayMode = window === "day";
  const showMonthYearPicker = isDayMode || window === "week";
  const showYearPicker = window === "month" || window === "year";

  const handlePrev = () => {
    const unit = showMonthYearPicker ? "month" : window === "month" ? "year" : window;
    onChange(window, offsetWindow(unit, referenceDate, -1));
  };

  const handleNext = () => {
    const unit = showMonthYearPicker ? "month" : window === "month" ? "year" : window;
    onChange(window, offsetWindow(unit, referenceDate, 1));
  };

  const currentYear = new Date(referenceDate + "T00:00:00").getFullYear();

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Tab pills */}
      <div className="flex gap-0.5 rounded-xl bg-black/5 p-1 dark:bg-white/5">
        {TABS.map((tab) => {
          const active = tab.key === window;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key, referenceDate)}
              className={`relative rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "text-violet-700 dark:text-violet-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="balance-tab-bg"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-white/10"
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
          onClick={handlePrev}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300"
          aria-label="Previous"
        >
          <ChevronLeft size={16} />
        </button>

        {showMonthYearPicker ? (
          <MonthYearPicker
            referenceDate={referenceDate}
            onSelect={(date) => onChange(window, date)}
            label={label}
          />
        ) : showYearPicker ? (
          <YearPicker
            year={currentYear}
            onSelect={(y) => {
              const d = new Date(referenceDate + "T00:00:00");
              d.setFullYear(y);
              onChange(window, toLocalDateString(d));
            }}
          />
        ) : (
          <span className="min-w-[160px] text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
            {label}
          </span>
        )}

        <button
          onClick={handleNext}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300"
          aria-label="Next"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

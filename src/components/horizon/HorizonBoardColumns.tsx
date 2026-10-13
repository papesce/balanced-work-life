"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { groupKeyOf, type LensColumn } from "@/components/lens";

interface HorizonBoardColumnsProps {
  columns: LensColumn[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  renderColumn: (col: LensColumn) => ReactNode;
}

export function HorizonBoardColumns({
  columns,
  activeTab,
  onTabChange,
  renderColumn,
}: HorizonBoardColumnsProps) {
  return (
    <>
      {/* Mobile tab bar */}
      <div className="sticky top-[53px] z-10 mb-4 flex gap-1 overflow-x-auto rounded-xl bg-black/[0.03] p-1 md:hidden dark:bg-white/[0.04]">
        {columns.map((col) => (
          <button
            key={groupKeyOf(col.key)}
            onClick={() => onTabChange(groupKeyOf(col.key))}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === groupKeyOf(col.key)
                ? "bg-violet-100/80 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            }`}
          >
            {col.label}
          </button>
        ))}
      </div>

      {/* Desktop: columns stacked vertically */}
      <div className="hidden gap-5 md:flex md:flex-col">
        {columns.map((col, i) => (
          <motion.div
            key={groupKeyOf(col.key)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: "easeOut" }}
            className="min-w-0"
          >
            {renderColumn(col)}
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
            {renderColumn(columns.find((c) => groupKeyOf(c.key) === activeTab) ?? columns[0])}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

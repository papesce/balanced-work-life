"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toLocalDateString } from "@/lib/dateUtils";

const MONTHS = [
  ["Jan", "Feb", "Mar", "Apr"],
  ["May", "Jun", "Jul", "Aug"],
  ["Sep", "Oct", "Nov", "Dec"],
];

interface MonthYearPickerProps {
  referenceDate: string;
  onSelect: (date: string) => void;
  label: string;
}

export function MonthYearPicker({ referenceDate, onSelect, label }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => new Date(referenceDate + "T00:00:00").getFullYear());
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const currentMonth = new Date(referenceDate + "T00:00:00").getMonth();
  const currentYear = new Date(referenceDate + "T00:00:00").getFullYear();

  const updatePosition = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => {
          setYear(currentYear);
          setOpen(!open);
        }}
        className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors min-w-[160px] text-center"
      >
        {label}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{ position: "fixed", top: pos.top, left: pos.left, transform: "translateX(-50%)", zIndex: 9999 }}
              className="glass-card rounded-2xl p-4 shadow-lg w-[280px]"
            >
              {/* Year nav */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setYear((y) => y - 1)}
                  className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{year}</span>
                <button
                  onClick={() => setYear((y) => y + 1)}
                  className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-4 gap-1.5">
                {MONTHS.flat().map((month, i) => {
                  const selected = i === currentMonth && year === currentYear;
                  return (
                    <button
                      key={month}
                      onClick={() => {
                        const d = new Date(year, i, 1);
                        onSelect(toLocalDateString(d));
                        setOpen(false);
                      }}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selected
                          ? "bg-violet-500 text-white"
                          : "text-gray-600 dark:text-gray-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300"
                      }`}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

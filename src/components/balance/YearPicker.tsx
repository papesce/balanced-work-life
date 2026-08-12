"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 9;

interface YearPickerProps {
  year: number;
  onSelect: (year: number) => void;
}

export function YearPicker({ year, onSelect }: YearPickerProps) {
  const [open, setOpen] = useState(false);
  const [pageStart, setPageStart] = useState(() => year - Math.floor(PAGE_SIZE / 2));
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
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
  }, [open, year]);

  const years = Array.from({ length: PAGE_SIZE }, (_, i) => pageStart + i);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => {
          setPageStart(year - Math.floor(PAGE_SIZE / 2));
          setOpen(!open);
        }}
        className="min-w-[120px] text-center text-sm font-semibold text-gray-700 transition-colors hover:text-violet-600 dark:text-gray-300 dark:hover:text-violet-400"
      >
        {year}
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
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                transform: "translateX(-50%)",
                zIndex: 9999,
              }}
              className="glass-card w-[280px] rounded-2xl p-4 shadow-lg"
            >
              {/* Year nav */}
              <div className="mb-3 flex items-center justify-between">
                <button
                  onClick={() => setPageStart((s) => s - PAGE_SIZE)}
                  className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                  {years[0]}–{years[years.length - 1]}
                </span>
                <button
                  onClick={() => setPageStart((s) => s + PAGE_SIZE)}
                  className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Year grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {years.map((y) => {
                  const selected = y === year;
                  return (
                    <button
                      key={y}
                      onClick={() => {
                        onSelect(y);
                        setOpen(false);
                      }}
                      className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? "bg-violet-500 text-white"
                          : "text-gray-600 hover:bg-violet-100 hover:text-violet-700 dark:text-gray-400 dark:hover:bg-violet-900/30 dark:hover:text-violet-300"
                      }`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

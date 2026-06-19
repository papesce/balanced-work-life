"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { getToday, getTomorrow } from "@/lib/dateUtils";

interface FloatingAddButtonProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAdd: (text: string, date: string | null) => Promise<void>;
  today: string;
}

export function FloatingAddButton({ open, onOpen, onClose, onAdd, today }: FloatingAddButtonProps) {
  const [text, setText] = useState("");
  const [when, setWhen] = useState<"today" | "tomorrow" | "inbox">("today");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setText(""); setWhen("today"); }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const tomorrow = getTomorrow();
    const date = when === "today" ? today : when === "tomorrow" ? tomorrow : null;
    await onAdd(text.trim(), date);
  };

  const tomorrow = getTomorrow();

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed bottom-24 right-6 z-50 w-80 glass-card-strong rounded-2xl p-4 shadow-2xl border border-white/20 dark:border-white/10"
            >
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full bg-white/60 dark:bg-gray-800/60 border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-violet-500/30 focus:outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
                />

                <div className="flex gap-1.5">
                  {(["today", "tomorrow", "inbox"] as const).map((opt) => {
                    const labels = {
                      today: `Today · ${today.slice(8)}/${today.slice(5, 7)}`,
                      tomorrow: `Tomorrow · ${tomorrow.slice(8)}/${tomorrow.slice(5, 7)}`,
                      inbox: "No date",
                    };
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setWhen(opt)}
                        className={`flex-1 text-[11px] px-2 py-1.5 rounded-lg border transition-all font-medium ${
                          when === opt
                            ? "bg-violet-100/80 dark:bg-violet-500/20 border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-400"
                            : "border-black/10 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-white/5"
                        }`}
                      >
                        {labels[opt]}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 border border-black/10 dark:border-white/10 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    className="flex-1 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-all disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button
        onClick={open ? onClose : onOpen}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        aria-label="Add task"
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
          <Plus size={22} strokeWidth={2.5} />
        </motion.div>
      </motion.button>
    </>
  );
}

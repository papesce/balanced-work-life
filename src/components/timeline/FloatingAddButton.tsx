"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { getTomorrow } from "@/lib/dateUtils";

interface FloatingAddButtonProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAdd: (text: string, date: string | null) => Promise<void>;
  today: string;
}

export function FloatingAddButton({ open, onOpen, onClose, onAdd, today }: FloatingAddButtonProps) {
  const [text, setText] = useState("");
  const [when, setWhen] = useState<"today" | "tomorrow" | "draft">("today");
  const inputRef = useRef<HTMLInputElement>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setText("");
      setWhen("today");
    }
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
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
              className="glass-card-strong fixed right-6 bottom-24 z-50 w-80 rounded-2xl border border-white/20 p-4 shadow-2xl dark:border-white/10"
            >
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full rounded-xl border border-black/10 bg-white/60 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-violet-500/30 focus:outline-none dark:border-white/10 dark:bg-gray-800/60 dark:text-gray-200 dark:placeholder:text-gray-500"
                />

                <div className="flex gap-1.5">
                  {(["today", "tomorrow", "draft"] as const).map((opt) => {
                    const labels = {
                      today: `Today · ${today.slice(8)}/${today.slice(5, 7)}`,
                      tomorrow: `Tomorrow · ${tomorrow.slice(8)}/${tomorrow.slice(5, 7)}`,
                      draft: "No date",
                    };
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setWhen(opt)}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all ${
                          when === opt
                            ? "border-violet-200 bg-violet-100/80 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/20 dark:text-violet-400"
                            : "border-black/10 text-gray-500 hover:bg-white/60 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
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
                    className="flex-1 rounded-xl border border-black/10 py-2 text-sm text-gray-500 transition-all hover:bg-white/40 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-medium text-white transition-all hover:bg-violet-700 disabled:opacity-40"
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
        className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg transition-colors hover:bg-violet-700"
        aria-label="Add task"
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
          <Plus size={22} strokeWidth={2.5} />
        </motion.div>
      </motion.button>
    </>
  );
}

"use client";

import { useState } from "react";
import { getToday, getTomorrow } from "@/lib/dateUtils";

type WhenOption = "today" | "tomorrow" | "custom" | "none";

interface QuickAddButtonProps {
  onAdd: (text: string, scheduledDate: string | null) => Promise<unknown>;
}

export function QuickAddButton({ onAdd }: QuickAddButtonProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [when, setWhen] = useState<WhenOption>("today");
  const [customDate, setCustomDate] = useState("");

  const getScheduledDate = (): string | null => {
    if (when === "today") return getToday();
    if (when === "tomorrow") return getTomorrow();
    if (when === "custom") return customDate || null;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onAdd(text.trim(), getScheduledDate());
    setText("");
    setWhen("today");
    setCustomDate("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg text-violet-600 dark:text-violet-400 rounded-full shadow-lg flex items-center justify-center text-2xl font-light hover:bg-white dark:hover:bg-gray-800 hover:shadow-xl active:scale-95 transition-all z-50 border border-white/30 dark:border-white/10"
        aria-label="Add task"
      >
        +
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="glass-card-strong rounded-[24px] p-6 w-full max-w-md space-y-4"
      >
        <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">Quick Add</h2>
        <input
          type="text"
          placeholder="What needs to be done?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          className="w-full bg-white/60 dark:bg-gray-800/60 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-violet-500/30 focus:outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500 transition-all"
        />

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5 font-medium">When</label>
          <div className="flex gap-2 flex-wrap">
            {(["today", "tomorrow", "custom", "none"] as WhenOption[]).map((opt) => {
              const today = getToday();
              const tomorrow = getTomorrow();
              const label = opt === "today" ? `Today (${today.split("-").slice(1).reverse().join("/")})`
                          : opt === "tomorrow" ? `Tomorrow (${tomorrow.split("-").slice(1).reverse().join("/")})`
                          : opt === "custom" ? "Pick date"
                          : "No date";
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setWhen(opt)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                    when === opt
                      ? "bg-violet-100/80 dark:bg-violet-500/20 border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-400 font-medium"
                      : "border-black/10 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800/60"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {when === "custom" && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="mt-2 w-full bg-white/60 dark:bg-gray-800/60 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-violet-500/30 focus:outline-none"
            />
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 py-2.5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-all shadow-sm"
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

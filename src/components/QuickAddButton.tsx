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
        className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/80 text-2xl font-light text-violet-600 shadow-lg backdrop-blur-lg transition-all hover:bg-white hover:shadow-xl active:scale-95 dark:border-white/10 dark:bg-gray-800/80 dark:text-violet-400 dark:hover:bg-gray-800"
        aria-label="Add task"
      >
        +
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 backdrop-blur-sm sm:items-center dark:bg-black/60">
      <form
        onSubmit={handleSubmit}
        className="glass-card-strong w-full max-w-md space-y-4 rounded-[24px] p-6"
      >
        <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">Quick Add</h2>
        <input
          type="text"
          placeholder="What needs to be done?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          className="w-full rounded-xl border border-black/10 bg-white/60 px-4 py-2.5 text-sm text-gray-800 transition-all placeholder:text-gray-300 focus:ring-2 focus:ring-violet-500/30 focus:outline-none dark:border-white/10 dark:bg-gray-800/60 dark:text-gray-200 dark:placeholder:text-gray-500"
        />

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
            When
          </label>
          <div className="flex flex-wrap gap-2">
            {(["today", "tomorrow", "custom", "none"] as WhenOption[]).map((opt) => {
              const today = getToday();
              const tomorrow = getTomorrow();
              const label =
                opt === "today"
                  ? `Today (${today.split("-").slice(1).reverse().join("/")})`
                  : opt === "tomorrow"
                    ? `Tomorrow (${tomorrow.split("-").slice(1).reverse().join("/")})`
                    : opt === "custom"
                      ? "Pick date"
                      : "No date";
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setWhen(opt)}
                  className={`rounded-xl border px-3 py-1.5 text-xs transition-all ${
                    when === opt
                      ? "border-violet-200 bg-violet-100/80 font-medium text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/20 dark:text-violet-400"
                      : "border-black/10 text-gray-500 hover:bg-white/60 dark:border-white/10 dark:text-gray-400 dark:hover:bg-gray-800/60"
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
              className="mt-2 w-full rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-violet-500/30 focus:outline-none dark:border-white/10 dark:bg-gray-800/60 dark:text-gray-200"
            />
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-xl border border-black/10 py-2.5 text-sm text-gray-500 transition-all hover:bg-white/60 dark:border-white/10 dark:text-gray-400 dark:hover:bg-gray-800/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-violet-700"
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

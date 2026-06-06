"use client";

import { useState } from "react";
import { LifeArea } from "@/lib/types";
import { getToday, getTomorrow } from "@/lib/dateUtils";

const AREAS: { value: LifeArea; label: string }[] = [
  { value: "work", label: "Work" },
  { value: "health", label: "Health" },
  { value: "relationships", label: "Relationships" },
  { value: "growth", label: "Growth" },
  { value: "finances", label: "Finances" },
  { value: "life", label: "Life" },
];

type WhenOption = "today" | "tomorrow" | "custom" | "none";

interface QuickAddButtonProps {
  onAdd: (text: string, area: LifeArea, scheduledDate: string | null) => Promise<unknown>;
}

export function QuickAddButton({ onAdd }: QuickAddButtonProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [area, setArea] = useState<LifeArea>("work");
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
    await onAdd(text.trim(), area, getScheduledDate());
    setText("");
    setWhen("today");
    setArea("work");
    setCustomDate("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-indigo-700 active:scale-95 transition-transform z-50"
        aria-label="Add task"
      >
        +
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl p-6 w-full max-w-md space-y-4"
      >
        <h2 className="text-lg font-semibold">Quick Add</h2>
        <input
          type="text"
          placeholder="What needs to be done?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />

        <div>
          <label className="text-sm text-gray-600 block mb-1">When</label>
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
                  className={`text-sm px-3 py-1.5 rounded-lg border ${
                    when === opt
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-medium"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
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
              className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
            />
          )}
        </div>

        <div>
          <label className="text-sm text-gray-600 block mb-1">Area</label>
          <div className="flex gap-2 flex-wrap">
            {AREAS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setArea(value)}
                className={`text-sm px-3 py-1.5 rounded-lg border ${
                  area === value
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-medium"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

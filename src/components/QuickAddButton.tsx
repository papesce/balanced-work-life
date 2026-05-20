"use client";

import { useState } from "react";
import { TimeBucket, BalanceCategory } from "@/lib/types";

interface QuickAddButtonProps {
  onAdd: (
    title: string,
    bucket: TimeBucket,
    category: BalanceCategory
  ) => Promise<void>;
}

export function QuickAddButton({ onAdd }: QuickAddButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [bucket, setBucket] = useState<TimeBucket>("today");
  const [category, setCategory] = useState<BalanceCategory>("work");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onAdd(title.trim(), bucket, category);
    setTitle("");
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
        <h2 className="text-lg font-semibold">New Task</h2>
        <input
          type="text"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm text-gray-600 block mb-1">When</label>
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value as TimeBucket)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="next_week">Next Week</option>
              <option value="backlog">Backlog</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm text-gray-600 block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BalanceCategory)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="work">Work</option>
              <option value="life">Life</option>
            </select>
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

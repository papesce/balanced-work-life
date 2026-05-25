"use client";

import { useState } from "react";
import { Task, TimeBucket, BalanceCategory } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  onComplete: (id: string, completedAt?: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskCard({ task, onComplete, onUpdate, onDelete }: TaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [bucket, setBucket] = useState<TimeBucket>(task.time_bucket);
  const [category, setCategory] = useState<BalanceCategory>(task.balance_category);

  const handleSave = async () => {
    await onUpdate(task.id, {
      title,
      notes,
      time_bucket: bucket,
      balance_category: category,
    });
    setEditing(false);
  };

  const categoryColor =
    task.balance_category === "work"
      ? "border-l-indigo-500"
      : "border-l-emerald-500";

  if (editing) {
    return (
      <div className={`bg-white rounded-lg border-l-4 ${categoryColor} p-4 shadow-sm space-y-3`}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes..."
          className="w-full border rounded px-3 py-1.5 text-sm resize-none h-16 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
        <div className="flex gap-3">
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value as TimeBucket)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="next_week">Next Week</option>
            <option value="backlog">Backlog</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as BalanceCategory)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="work">Work</option>
            <option value="life">Life</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-1 border rounded text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="px-3 py-1 text-red-600 text-sm ml-auto hover:bg-red-50 rounded"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  const handleBackdate = async (dateStr: string) => {
    const date = new Date(dateStr + "T23:59:00");
    await onComplete(task.id, date.toISOString());
    setShowDatePicker(false);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className={`bg-white rounded-lg border-l-4 ${categoryColor} p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        {task.status === "active" && (
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onComplete(task.id)}
              className="mt-0.5 w-5 h-5 border-2 border-gray-300 rounded-full hover:border-indigo-500 transition-colors"
              aria-label="Complete task"
            />
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="text-[10px] text-gray-400 hover:text-indigo-500 transition-colors"
              aria-label="Complete on a different date"
              title="Done on..."
            >
              ...
            </button>
          </div>
        )}
        <div className="flex-1 min-w-0" onClick={() => setEditing(true)}>
          <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-gray-400" : "text-gray-900"}`}>
            {task.title}
          </p>
          {task.notes && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{task.notes}</p>
          )}
          <div className="flex gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">
              {task.time_bucket.replace("_", " ")}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                task.balance_category === "work"
                  ? "bg-indigo-50 text-indigo-600"
                  : "bg-emerald-50 text-emerald-600"
              }`}
            >
              {task.balance_category}
            </span>
          </div>
          {task.idea_id && (
            <a
              href={`/brainstorm?highlight=${task.idea_id}`}
              className="inline-flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700 mt-1"
              title="Ver idea en brainstorm"
            >
              <span className="text-[10px]">🧠</span>
              <span>Idea</span>
            </a>
          )}
        </div>
      </div>
      {showDatePicker && (
        <div className="mt-3 pt-3 border-t flex items-center gap-2">
          <label className="text-xs text-gray-500">Done on:</label>
          <input
            type="date"
            max={today}
            className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            onChange={(e) => {
              if (e.target.value) handleBackdate(e.target.value);
            }}
          />
          <button
            onClick={() => setShowDatePicker(false)}
            className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Clock, Trash2, X } from "lucide-react";
import { LAYER_MODAL } from "@/lib/layers";
import type { Idea } from "@/lib/types";

export interface EventValues {
  text: string;
  scheduled_date: string;
  scheduled_time: string | null;
  duration_minutes: number | null;
}

export function EventEditor({
  event,
  initialDate,
  onSave,
  onDelete,
  onClose,
}: {
  event: Idea | null;
  initialDate: string;
  onSave: (values: EventValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(event?.text ?? "");
  const [date, setDate] = useState(event?.scheduled_date ?? initialDate);
  const [time, setTime] = useState(event?.scheduled_time?.slice(0, 5) ?? "");
  const [duration, setDuration] = useState(event?.duration_minutes?.toString() ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      setError("Enter a title and date.");
      return;
    }
    const durationValue = duration ? Number(duration) : null;
    if (durationValue !== null && (!Number.isInteger(durationValue) || durationValue < 1)) {
      setError("Duration must be a positive number of minutes.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        text: title.trim(),
        scheduled_date: date,
        scheduled_time: time || null,
        duration_minutes: time && durationValue ? durationValue : null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this event.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete this event.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
      style={{ zIndex: LAYER_MODAL }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-editor-title"
        className="glass-card w-full max-w-md rounded-2xl p-5 shadow-xl"
      >
        <header className="mb-4 flex items-center justify-between">
          <h2
            id="event-editor-title"
            className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100"
          >
            <CalendarDays size={16} className="text-indigo-600 dark:text-indigo-300" />
            {event ? "Edit event" : "New event"}
          </h2>
          <button
            type="button"
            aria-label="Close event editor"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-200"
          >
            <X size={15} />
          </button>
        </header>

        <form onSubmit={handleSave} className="space-y-3">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Title
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              required
              placeholder="Birthday, concert, shift…"
              className="mt-1.5 w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-100"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-gray-600 sm:col-span-1 dark:text-gray-300">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white/70 px-2.5 py-2 text-sm text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-100"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600 sm:col-span-1 dark:text-gray-300">
              Start time
              <span className="relative mt-1.5 block">
                <Clock
                  size={13}
                  className="pointer-events-none absolute top-2.5 left-2.5 text-gray-400"
                />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white/70 py-2 pr-2 pl-8 text-sm text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-100"
                />
              </span>
              <span className="mt-1 block text-[10px] font-normal text-gray-400">
                Empty means all day
              </span>
            </label>
            <label className="text-xs font-semibold text-gray-600 sm:col-span-1 dark:text-gray-300">
              Duration
              <span className="relative mt-1.5 block">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  disabled={!time}
                  placeholder="Optional"
                  className="w-full rounded-xl border border-black/10 bg-white/70 px-2.5 py-2 pr-9 text-sm text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-100"
                />
                <span className="pointer-events-none absolute top-2.5 right-2.5 text-[10px] text-gray-400">
                  min
                </span>
              </span>
              <span className="mt-1 block text-[10px] font-normal text-gray-400">
                Timed events only
              </span>
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300"
            >
              {error}
            </p>
          )}

          {confirmDelete ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50/70 p-3 dark:border-red-900/40 dark:bg-red-950/20">
              <span className="text-xs font-medium text-red-700 dark:text-red-300">
                Delete this event?
              </span>
              <span className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-black/5"
                >
                  Keep
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleDelete()}
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Delete
                </button>
              </span>
            </div>
          ) : (
            <footer className="flex items-center justify-between gap-3 border-t border-black/5 pt-3 dark:border-white/5">
              {event && onDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              ) : (
                <span />
              )}
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                >
                  {saving ? "Saving…" : event ? "Save changes" : "Create event"}
                </button>
              </span>
            </footer>
          )}
        </form>
      </section>
    </div>,
    document.body,
  );
}

"use client";

import { useState } from "react";
import { Tag, X, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useTags } from "@/hooks/useTags";
import { LifeArea } from "@/lib/types";
import { AREA_DOT_COLORS, AREA_LABELS, AREA_ORDER, AREA_TEXT_COLORS } from "@/lib/constants";

export default function TagsSettingsPage() {
  const { tags, loading, createTag, deleteTag } = useTags();
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState<LifeArea>("life");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    await createTag(newName.trim(), newArea);
    setNewName("");
    setCreating(false);
    setShowForm(false);
  };

  const grouped = AREA_ORDER.reduce<Record<LifeArea, typeof tags>>(
    (acc, area) => {
      acc[area] = tags.filter((t) => t.area === area);
      return acc;
    },
    {} as Record<LifeArea, typeof tags>,
  );

  return (
    <AppShell title="Tags">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200">Your Tags</h2>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              Tags let you label tasks with custom categories. Each tag belongs to one life area.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-600 transition-all hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
            >
              <Plus size={13} /> New Tag
            </button>
          )}
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="glass-card space-y-3 rounded-2xl border border-black/5 p-4 dark:border-white/5"
          >
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">New Tag</p>
            <input
              type="text"
              placeholder="Tag name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-violet-500/30 focus:outline-none dark:border-white/10 dark:bg-gray-800/60 dark:text-gray-200 dark:placeholder:text-gray-500"
            />
            <div>
              <p className="mb-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                Life Area
              </p>
              <div className="flex flex-wrap gap-1.5">
                {AREA_ORDER.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setNewArea(area)}
                    className={`flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all ${
                      newArea === area
                        ? "border-current bg-black/5 dark:bg-white/10"
                        : "border-black/10 text-gray-400 hover:border-current dark:border-white/10"
                    } ${AREA_TEXT_COLORS[area]}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${AREA_DOT_COLORS[area]}`} />
                    {AREA_LABELS[area]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setNewName("");
                }}
                className="flex-1 cursor-pointer rounded-xl border border-black/10 py-2 text-xs font-semibold text-gray-500 transition-all hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="flex-1 cursor-pointer rounded-xl bg-violet-600 py-2 text-xs font-bold text-white transition-all hover:bg-violet-700 disabled:opacity-50"
              >
                {creating ? "Adding..." : "Add Tag"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="animate-pulse py-8 text-center text-xs text-gray-400 dark:text-gray-500">
            Loading tags...
          </div>
        ) : (
          <div className="space-y-4">
            {AREA_ORDER.map((area) => {
              const areaTags = grouped[area];
              if (areaTags.length === 0) return null;
              return (
                <div
                  key={area}
                  className="glass-card overflow-hidden rounded-2xl border border-black/5 dark:border-white/5"
                >
                  <div className="flex items-center gap-2 border-b border-black/5 bg-black/[0.01] px-4 py-2.5 dark:border-white/5 dark:bg-white/[0.01]">
                    <span className={`h-2 w-2 rounded-full ${AREA_DOT_COLORS[area]}`} />
                    <span className={`text-xs font-bold ${AREA_TEXT_COLORS[area]}`}>
                      {AREA_LABELS[area]}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                      {areaTags.length}
                    </span>
                  </div>
                  <div className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
                    {areaTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="group flex items-center justify-between px-4 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <Tag size={12} className="text-gray-400" />
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            {tag.name}
                          </span>
                          {tag.is_system && (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-400 dark:bg-gray-700/50">
                              system
                            </span>
                          )}
                        </div>
                        {!tag.is_system && (
                          <button
                            onClick={() => deleteTag(tag.id)}
                            className="cursor-pointer text-gray-300 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400 dark:text-gray-600"
                            title="Delete tag"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {tags.length === 0 && (
              <div className="py-16 text-center text-gray-400 dark:text-gray-500">
                <Tag size={28} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold">No tags yet</p>
                <p className="mt-1 text-xs">Create your first tag above</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

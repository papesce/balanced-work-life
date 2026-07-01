"use client";

import { useState } from "react";
import { Tag, X, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useTags } from "@/hooks/useTags";
import { LifeArea } from "@/lib/types";
import { AREA_LABELS, AREA_ORDER } from "@/components/planner/constants";
import { AREA_DOT_COLORS } from "@/components/shared/TagPicker";

const AREA_TEXT: Record<LifeArea, string> = {
  work: "text-blue-600 dark:text-blue-400",
  health: "text-red-600 dark:text-red-400",
  relationships: "text-pink-600 dark:text-pink-400",
  growth: "text-amber-600 dark:text-amber-400",
  finances: "text-emerald-600 dark:text-emerald-400",
  life: "text-green-600 dark:text-green-400",
};

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

  const grouped = AREA_ORDER.reduce<Record<LifeArea, typeof tags>>((acc, area) => {
    acc[area] = tags.filter((t) => t.area === area);
    return acc;
  }, {} as Record<LifeArea, typeof tags>);

  return (
    <AppShell title="Tags">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200">Your Tags</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Tags let you label tasks with custom categories. Each tag belongs to one life area.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              <Plus size={13} /> New Tag
            </button>
          )}
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="glass-card rounded-2xl p-4 border border-black/5 dark:border-white/5 space-y-3"
          >
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">New Tag</p>
            <input
              type="text"
              placeholder="Tag name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="w-full bg-white/60 dark:bg-gray-800/60 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-violet-500/30 focus:outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
            />
            <div>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5">Life Area</p>
              <div className="flex flex-wrap gap-1.5">
                {AREA_ORDER.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setNewArea(area)}
                    className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                      newArea === area
                        ? "border-current bg-black/5 dark:bg-white/10"
                        : "border-black/10 dark:border-white/10 text-gray-400 hover:border-current"
                    } ${AREA_TEXT[area]}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${AREA_DOT_COLORS[area]}`} />
                    {AREA_LABELS[area]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setNewName(""); }}
                className="flex-1 py-2 text-xs border border-black/10 dark:border-white/10 rounded-xl text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="flex-1 py-2 text-xs bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-all font-bold cursor-pointer"
              >
                {creating ? "Adding..." : "Add Tag"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-xs text-gray-400 dark:text-gray-500 py-8 text-center animate-pulse">Loading tags...</div>
        ) : (
          <div className="space-y-4">
            {AREA_ORDER.map((area) => {
              const areaTags = grouped[area];
              if (areaTags.length === 0) return null;
              return (
                <div key={area} className="glass-card rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
                    <span className={`w-2 h-2 rounded-full ${AREA_DOT_COLORS[area]}`} />
                    <span className={`text-xs font-bold ${AREA_TEXT[area]}`}>{AREA_LABELS[area]}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold">{areaTags.length}</span>
                  </div>
                  <div className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
                    {areaTags.map((tag) => (
                      <div key={tag.id} className="flex items-center justify-between px-4 py-2.5 group">
                        <div className="flex items-center gap-2">
                          <Tag size={12} className="text-gray-400" />
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{tag.name}</span>
                          {tag.is_system && (
                            <span className="text-[9px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">system</span>
                          )}
                        </div>
                        {!tag.is_system && (
                          <button
                            onClick={() => deleteTag(tag.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-all cursor-pointer"
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
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <Tag size={28} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold">No tags yet</p>
                <p className="text-xs mt-1">Create your first tag above</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

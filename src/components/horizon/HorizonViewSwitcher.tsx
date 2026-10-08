"use client";

import { useState } from "react";
import { Bookmark, Check, ChevronDown, Copy, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { summarizeHorizonView, type HorizonView } from "@/lib/horizonViews";
import { FloatingPanel } from "@/components/shared/FloatingPanel";

interface HorizonViewSwitcherProps {
  views: HorizonView[];
  activeViewId: string | null;
  defaultViewId: string | null;
  dirty: boolean;
  schemeLabelOf: (schemeKey: string) => string | null;
  onSelect: (id: string) => void;
  onSaveCurrent: (name: string) => void;
  onOverwriteActive: () => void;
  onRevertActive: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleDefault: (id: string) => void;
}

export function HorizonViewSwitcher({
  views,
  activeViewId,
  defaultViewId,
  dirty,
  schemeLabelOf,
  onSelect,
  onSaveCurrent,
  onOverwriteActive,
  onRevertActive,
  onRename,
  onDelete,
  onDuplicate,
  onToggleDefault,
}: HorizonViewSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  // Outside-click, Escape, scroll and resize handling is owned by FloatingPanel.

  const active = views.find((v) => v.id === activeViewId) ?? null;

  const submitCreate = () => {
    const name = draftName.trim();
    if (!name) return;
    onSaveCurrent(name);
    setDraftName("");
    setCreating(false);
    setOpen(false);
  };

  const submitRename = () => {
    if (!renamingId) return;
    const name = renameDraft.trim();
    if (name) onRename(renamingId, name);
    setRenamingId(null);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMenuPos({ top: rect.bottom + 4, left: rect.left });
          setOpen((v) => !v);
        }}
        title={active ? `Horizon view: ${active.name}` : "Save and switch Horizon views"}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          active
            ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-900/20 dark:text-violet-300"
            : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
        }`}
      >
        <Bookmark size={12} />
        <span className="hidden max-w-[140px] truncate sm:inline">
          {active ? active.name : "Views"}
        </span>
        {dirty && (
          <span
            title="Unsaved changes"
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500"
          />
        )}
        <ChevronDown size={12} className="flex-shrink-0 opacity-60" />
      </button>
      {open && menuPos && (
        <FloatingPanel
          anchor={menuPos}
          onClose={() => {
            setOpen(false);
            setCreating(false);
            setRenamingId(null);
          }}
          className="w-72 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-gray-900"
        >
          <div className="max-h-64 overflow-y-auto p-1">
            {views.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400 italic">
                No saved views yet. Pick a primary classification, set splits, then save it here
                with a name.
              </p>
            )}
            {views.map((view) => {
              const isActive = view.id === activeViewId;
              const isDefault = view.id === defaultViewId;
              if (renamingId === view.id) {
                return (
                  <div key={view.id} className="flex items-center gap-1 p-1">
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-violet-300 px-2 py-1.5 text-xs dark:border-violet-500/50 dark:bg-gray-800"
                    />
                    <button
                      type="button"
                      onClick={submitRename}
                      aria-label="Confirm rename"
                      className="rounded p-1.5 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                    >
                      <Check size={13} />
                    </button>
                  </div>
                );
              }
              return (
                <div
                  key={view.id}
                  className={`group flex items-center gap-0.5 rounded-lg ${
                    isActive
                      ? "bg-violet-50 dark:bg-violet-900/20"
                      : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(view.id);
                      setOpen(false);
                    }}
                    title={summarizeHorizonView(view, schemeLabelOf)}
                    className="min-w-0 flex-1 px-3 py-2 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-700 dark:text-gray-200">
                        {view.name}
                      </span>
                      {isDefault && (
                        <Star size={11} className="flex-shrink-0 fill-amber-400 text-amber-400" />
                      )}
                      {isActive && dirty && (
                        <span
                          title="Unsaved changes"
                          className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500"
                        />
                      )}
                      {isActive && <Check size={13} className="flex-shrink-0 text-violet-600" />}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-gray-400 dark:text-gray-500">
                      {summarizeHorizonView(view, schemeLabelOf)}
                    </span>
                  </button>
                  <span className="flex flex-shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => onToggleDefault(view.id)}
                      aria-label={
                        isDefault
                          ? `Remove ${view.name} as default view`
                          : `Set ${view.name} as default view`
                      }
                      title={isDefault ? "Default view (click to unset)" : "Set as default view"}
                      className={`rounded p-1.5 ${
                        isDefault
                          ? "text-amber-500"
                          : "text-gray-400 opacity-0 group-hover:opacity-100 hover:text-amber-500"
                      }`}
                    >
                      <Star size={12} className={isDefault ? "fill-amber-400" : ""} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicate(view.id)}
                      aria-label={`Duplicate ${view.name}`}
                      title="Duplicate"
                      className="rounded p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-violet-600"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(view.id);
                        setRenameDraft(view.name);
                      }}
                      aria-label={`Rename ${view.name}`}
                      className="rounded p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-violet-600"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(view.id)}
                      aria-label={`Delete ${view.name}`}
                      className="rounded p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-black/5 p-1 dark:border-white/5">
            {active && dirty && (
              <div className="flex gap-1 p-1">
                <button
                  type="button"
                  onClick={() => {
                    onOverwriteActive();
                    setOpen(false);
                  }}
                  className="flex-1 rounded-lg bg-violet-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRevertActive();
                    setOpen(false);
                  }}
                  className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-500 hover:bg-black/[0.03] dark:border-gray-700 dark:text-gray-400"
                >
                  Revert
                </button>
              </div>
            )}
            {creating ? (
              <div className="flex items-center gap-1 p-1">
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitCreate();
                    if (e.key === "Escape") setCreating(false);
                  }}
                  placeholder="View name…"
                  className="min-w-0 flex-1 rounded-lg border border-violet-300 px-2 py-1.5 text-xs dark:border-violet-500/50 dark:bg-gray-800"
                />
                <button
                  type="button"
                  onClick={submitCreate}
                  aria-label="Save view"
                  className="rounded p-1.5 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                >
                  <Check size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"
              >
                <Plus size={13} />
                Save current as new view
              </button>
            )}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}

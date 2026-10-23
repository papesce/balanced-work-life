"use client";

import { useMemo, useState } from "react";
import { Link as LinkIcon, Unlink } from "lucide-react";
import { useQuery } from "@powersync/react";
import { useAuth } from "@/hooks/useAuth";

interface AssociationPanelProps {
  pathId: string;
  currentAssociations: string[];
  onAssociate: (targetId: string) => Promise<void>;
  onDisassociate: (targetId: string) => Promise<void>;
}

export function PathAssociationPanel({
  pathId,
  currentAssociations,
  onAssociate,
  onDisassociate,
}: AssociationPanelProps) {
  const { user } = useAuth();
  const [targetId, setTargetId] = useState("");
  const { data: ideas } = useQuery<Record<string, unknown>>(
    user
      ? "SELECT id, text, type FROM ideas WHERE user_id = ? AND id != ? ORDER BY text"
      : "SELECT * FROM ideas WHERE 0",
    user ? [user.id, pathId] : [],
  );
  const options = useMemo(
    () => ideas.filter((idea) => !currentAssociations.includes(String(idea.id))),
    [ideas, currentAssociations],
  );

  return (
    <div className="glass-card-strong min-w-[260px] rounded-xl border border-gray-200 p-3 shadow-xl dark:border-gray-700">
      <p className="mb-2 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
        Associations
      </p>

      <div className="mb-3 space-y-1">
        {currentAssociations.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No associations</p>
        ) : (
          currentAssociations.map((id) => (
            <div
              key={id}
              className="flex items-center justify-between gap-2 rounded-lg bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800"
            >
              <span className="truncate">
                {String(ideas.find((idea) => idea.id === id)?.text ?? id)}
              </span>
              <button
                onClick={() => void onDisassociate(id)}
                className="text-gray-400 hover:text-rose-500"
              >
                <Unlink size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          aria-label="Associate path with idea"
          className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-violet-500 dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="">Associate with…</option>
          {options.map((idea) => (
            <option key={String(idea.id)} value={String(idea.id)}>
              {String(idea.text || idea.type || "Untitled")}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            if (targetId) {
              void onAssociate(targetId);
              setTargetId("");
            }
          }}
          className="rounded-lg bg-violet-600 p-1.5 text-white hover:bg-violet-700"
        >
          <LinkIcon size={14} />
        </button>
      </div>
    </div>
  );
}

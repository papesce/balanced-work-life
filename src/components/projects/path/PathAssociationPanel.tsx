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
  onError: (message: string) => void;
}

export function PathAssociationPanel({
  pathId,
  currentAssociations,
  onAssociate,
  onDisassociate,
  onError,
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
    <div className="w-full rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-800/40">
      <p className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
        Path associations
      </p>
      <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">
        Link this path to a project, idea, or goal.
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
                type="button"
                onClick={() =>
                  void onDisassociate(id).catch((error: unknown) =>
                    onError(
                      error instanceof Error ? error.message : "Could not remove association.",
                    ),
                  )
                }
                aria-label={`Remove path association with ${String(ideas.find((idea) => idea.id === id)?.text ?? "item")}`}
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
          type="button"
          disabled={!targetId}
          aria-label="Add path association"
          onClick={() => {
            if (targetId) {
              void onAssociate(targetId)
                .then(() => setTargetId(""))
                .catch((error: unknown) =>
                  onError(error instanceof Error ? error.message : "Could not add association."),
                );
            }
          }}
          className="rounded-lg bg-violet-600 p-1.5 text-white hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LinkIcon size={14} />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { getRevealHref } from "@/lib/reveal";
import type { Idea } from "@/lib/types";

export function ParentChip({ task, ideas }: { task: Idea; ideas?: Idea[] }) {
  const router = useRouter();
  const parent = ideas?.find((i) => i.id === task.parent_id);
  if (!parent) return null;
  const isProject = parent.type === "project";
  const href = isProject
    ? getRevealHref("projects", parent, ideas)
    : getRevealHref("brainstorm", parent, ideas);
  return (
    <button
      title={`Reveal parent: ${parent.text || "Untitled"}`}
      aria-label={`Reveal parent ${parent.text || "Untitled"}`}
      onClick={(e) => {
        e.stopPropagation();
        router.push(href);
      }}
      className="max-w-[100px] cursor-pointer truncate rounded-full bg-black/[0.04] px-2 py-0.5 text-[9px] font-semibold text-gray-500 transition-colors hover:bg-black/[0.08] hover:text-gray-700 dark:bg-white/[0.06] dark:text-gray-400 dark:hover:bg-white/[0.10] dark:hover:text-gray-200"
    >
      in: {parent.text || "Untitled"}
    </button>
  );
}

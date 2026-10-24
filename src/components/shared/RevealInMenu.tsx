"use client";

import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Telescope,
  BrainCircuit,
  FolderKanban,
  Target,
  Eye,
  ArrowRightToLine,
} from "lucide-react";
import type { Idea } from "@/lib/types";
import { getRevealOptions, type RevealView } from "@/lib/reveal";
import { FloatingPanel, type FloatingAnchor } from "@/components/shared/FloatingPanel";

const VIEW_ICON: Record<RevealView, React.ReactNode> = {
  planner: <LayoutDashboard size={12} strokeWidth={1.5} />,
  timeline: <CalendarDays size={12} strokeWidth={1.5} />,
  horizon: <Telescope size={12} strokeWidth={1.5} />,
  brainstorm: <BrainCircuit size={12} strokeWidth={1.5} />,
  projects: <FolderKanban size={12} strokeWidth={1.5} />,
  goals: <Target size={12} strokeWidth={1.5} />,
};

interface RevealInMenuProps {
  idea: Idea;
  currentView: RevealView;
  position: FloatingAnchor | null;
  onClose: () => void;
  allIdeas?: Idea[];
  onAddToPath?: () => void;
  isInPath?: boolean;
  pathAddDisabled?: boolean;
}

export function RevealInMenu({
  idea,
  currentView,
  position,
  onClose,
  allIdeas,
  onAddToPath,
  isInPath = false,
  pathAddDisabled = false,
}: RevealInMenuProps) {
  const router = useRouter();
  if (!position) return null;
  const options = getRevealOptions(currentView, idea, allIdeas);
  if (options.length === 0 && !onAddToPath) return null;
  // Cascade next to the parent menu (the old fixed portal offset right by 200).
  const anchor: FloatingAnchor = {
    top: position.top,
    ...(position.right !== undefined ? { right: position.right + 200 } : {}),
    ...(position.left !== undefined ? { left: position.left - 200 } : {}),
  };
  return (
    <FloatingPanel
      anchor={anchor}
      onClose={onClose}
      className="glass-card-strong min-w-[180px] rounded-xl py-1.5 shadow-lg"
    >
      {onAddToPath && (
        <>
          <button
            type="button"
            disabled={isInPath || pathAddDisabled}
            title={
              isInPath
                ? "Already in this path"
                : pathAddDisabled
                  ? "This idea cannot be added to the path"
                  : undefined
            }
            onClick={() => {
              onAddToPath();
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-white/[0.04]"
          >
            <ArrowRightToLine size={12} strokeWidth={1.5} />
            {isInPath ? "Already in path" : "Add to path"}
          </button>
          {options.length > 0 && (
            <div className="my-1 border-t border-black/5 dark:border-white/5" />
          )}
        </>
      )}
      {options.length > 0 && (
        <p className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
          <Eye size={10} strokeWidth={1.5} />
          Reveal in
        </p>
      )}
      {options.map((opt) => (
        <button
          key={opt.view}
          onClick={() => {
            router.push(opt.href);
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
        >
          {VIEW_ICON[opt.view]}
          {opt.label}
        </button>
      ))}
    </FloatingPanel>
  );
}

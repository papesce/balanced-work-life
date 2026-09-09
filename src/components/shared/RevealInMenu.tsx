"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Telescope,
  BrainCircuit,
  FolderKanban,
  Target,
  Eye,
} from "lucide-react";
import type { Idea } from "@/lib/types";
import { getRevealOptions, type RevealView } from "@/lib/reveal";

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
  position: { top: number; right: number } | null;
  onClose: () => void;
  allIdeas?: Idea[];
}

export function RevealInMenu({
  idea,
  currentView,
  position,
  onClose,
  allIdeas,
}: RevealInMenuProps) {
  const router = useRouter();
  if (!position) return null;
  const options = getRevealOptions(currentView, idea, allIdeas);
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: position.top,
        right: position.right + 200,
        zIndex: 9999,
      }}
      className="glass-card-strong min-w-[180px] rounded-xl py-1.5 shadow-lg"
    >
      <p className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
        <Eye size={10} strokeWidth={1.5} />
        Reveal in
      </p>
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
    </div>,
    document.body,
  );
}

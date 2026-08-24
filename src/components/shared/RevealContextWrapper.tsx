"use client";

import { useState, useEffect } from "react";
import type { Idea } from "@/lib/types";
import type { RevealView } from "@/lib/reveal";
import { RevealInMenu } from "@/components/shared/RevealInMenu";

export function RevealContextWrapper({
  idea,
  currentView,
  children,
}: {
  idea: Idea;
  currentView: RevealView;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [open, setOpen] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // position flyout near cursor: top = y, right = viewport - x
    setPos({ top: e.clientY + 4, right: window.innerWidth - e.clientX - 4 });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", handler);
    document.addEventListener("contextmenu", handler);
    document.addEventListener("keydown", keyHandler);
    window.addEventListener("scroll", handler, true);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("contextmenu", handler);
      document.removeEventListener("keydown", keyHandler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open]);

  return (
    <div onContextMenu={handleContextMenu} className="min-w-0 flex-1">
      {children}
      {open && pos && (
        <RevealInMenu
          idea={idea}
          currentView={currentView}
          position={pos}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

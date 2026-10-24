"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { BrainstormPathViewMode } from "@/stores/uiPrefsStore";

const LazyPathEditor = dynamic(
  () => import("@/components/paths/PathEditor").then((mod) => mod.PathEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
        Loading path editor...
      </div>
    ),
  },
);

export function BrainstormPathLayout({
  pathId,
  mode,
  tree,
  splitRatio,
  onSplitResize,
}: {
  pathId: string;
  mode: BrainstormPathViewMode;
  tree: ReactNode;
  splitRatio: number;
  onSplitResize: (size: { asPercentage: number }) => void;
}) {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const updateViewport = () => setIsNarrow(window.innerWidth < 1024);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  if (mode === "tree") return tree;

  if (mode === "path") {
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LazyPathEditor pathId={pathId} mode="edit" fillHeight />
      </div>
    );
  }

  return (
    <Group
      orientation={isNarrow ? "vertical" : "horizontal"}
      className="flex min-h-0 w-full flex-1 overflow-hidden"
    >
      <Panel
        id="brainstorm-tree"
        defaultSize={`${Math.min(65, Math.max(22, splitRatio))}%`}
        minSize={isNarrow ? "35%" : "22%"}
        onResize={onSplitResize}
        className="relative min-h-0 min-w-0"
      >
        <div className="absolute inset-0 overflow-y-auto overscroll-y-contain pr-2">{tree}</div>
      </Panel>
      <Separator
        className={`shrink-0 rounded-full bg-gray-200 transition-colors hover:bg-violet-300 focus-visible:bg-violet-400 focus-visible:outline-none dark:bg-gray-700 dark:hover:bg-violet-700 ${
          isNarrow ? "my-1 h-2 cursor-row-resize" : "mx-1 w-2 cursor-col-resize"
        }`}
        aria-label="Resize Brainstorm tree and path editor"
      />
      <Panel
        id="brainstorm-path-editor"
        minSize={isNarrow ? "35%" : "30%"}
        className="min-h-0 min-w-0"
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            <LazyPathEditor pathId={pathId} mode="edit" fillHeight />
          </div>
        </div>
      </Panel>
    </Group>
  );
}

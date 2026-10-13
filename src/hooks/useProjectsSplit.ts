"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUiPrefsStore, type ProjectViewMode } from "@/stores/uiPrefsStore";
import type { PathCanvasApi } from "@/components/projects/ProjectPathsTab";
import { clampSplitRatio, resolveEffectiveMode, SPLIT_MIN_WIDTH } from "@/lib/projectSplit";

/**
 * Split-view layout plumbing: persisted mode + ratio, narrow-screen fallback,
 * path-canvas entry point, and canvas re-fit ticks after resizes.
 */
export function useProjectsSplit() {
  const setPrefs = useUiPrefsStore((s) => s.set);
  const projectViewMode = useUiPrefsStore((s) => s.projectViewMode);
  const projectSplitRatio = useUiPrefsStore((s) => s.projectSplitRatio);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : SPLIT_MIN_WIDTH,
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isNarrow = viewportWidth < SPLIT_MIN_WIDTH;
  const effectiveMode = resolveEffectiveMode(projectViewMode, viewportWidth);
  // Canvas entry point reported by ProjectPathsTab (selected path + add).
  const [canvasApi, setCanvasApi] = useState<PathCanvasApi | null>(null);
  const handleCanvasApi = useCallback((api: PathCanvasApi | null) => setCanvasApi(api), []);
  const handleAddToPath = useCallback(
    (id: string) => {
      void canvasApi?.addToPath(id);
    },
    [canvasApi],
  );
  const isInPath = useCallback((id: string) => canvasApi?.placedIds.has(id) ?? false, [canvasApi]);
  // Bumped after divider drags / collapses so the canvas re-fits its viewport.
  const [fitTick, setFitTick] = useState(0);
  const fitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpFit = useCallback(() => {
    if (fitTimer.current) clearTimeout(fitTimer.current);
    fitTimer.current = setTimeout(() => setFitTick((t) => t + 1), 200);
  }, []);
  useEffect(
    () => () => {
      if (fitTimer.current) clearTimeout(fitTimer.current);
    },
    [],
  );
  const ratioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (ratioTimer.current) clearTimeout(ratioTimer.current);
    },
    [],
  );
  const handleListResize = useCallback(
    (size: { asPercentage: number }) => {
      const next = clampSplitRatio(Math.round(size.asPercentage));
      if (ratioTimer.current) clearTimeout(ratioTimer.current);
      ratioTimer.current = setTimeout(() => setPrefs({ projectSplitRatio: next }), 400);
      bumpFit();
    },
    [bumpFit, setPrefs],
  );
  const setViewMode = useCallback(
    (mode: ProjectViewMode) => {
      setPrefs({ projectViewMode: mode });
      bumpFit();
    },
    [bumpFit, setPrefs],
  );

  return {
    projectSplitRatio,
    isNarrow,
    effectiveMode,
    canvasApi,
    handleCanvasApi,
    handleAddToPath,
    isInPath,
    fitTick,
    handleListResize,
    setViewMode,
  };
}

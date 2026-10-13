"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS, readRawString, writeRawString } from "@/lib/storage";

/**
 * Drag-to-resize right column with persisted width. No sync setState in
 * effects; persistence writes on drag end.
 */
export function useResizableColumn({
  storageKey = STORAGE_KEYS.plannerRightColWidth,
  defaultWidth = 360,
  min = 320,
  max = 600,
}: {
  storageKey?: string;
  defaultWidth?: number;
  min?: number;
  max?: number;
} = {}) {
  const [rightColWidth, setRightColWidth] = useState<number>(() => {
    const saved = readRawString(storageKey);
    if (saved) {
      const n = parseInt(saved, 10);
      if (!isNaN(n) && n >= min && n <= max) return n;
    }
    return defaultWidth;
  });
  const rightColWidthRef = useRef(rightColWidth);
  useEffect(() => {
    rightColWidthRef.current = rightColWidth;
  });

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = rightColWidthRef.current;

      const onMouseMove = (e: MouseEvent) => {
        const delta = startX - e.clientX;
        const newWidth = Math.min(Math.max(startWidth + delta, min), max);
        setRightColWidth(newWidth);
      };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        writeRawString(storageKey, String(rightColWidthRef.current));
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [max, min, storageKey],
  );

  return { rightColWidth, handleResizeStart };
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LAYER_FLOATING } from "@/lib/layers";

/** Precomputed anchor: `top` is the desired panel top; horizontal via `left` or `right` offset. */
export interface FloatingAnchor {
  top: number;
  left?: number;
  right?: number;
}

interface FloatingPanelProps {
  anchor: FloatingAnchor;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /**
   * Extra vertical gap assumed between trigger and panel (trigger height).
   * Used when flipping above the trigger near the viewport bottom.
   */
  triggerGap?: number;
}

const MARGIN = 8;

/**
 * Shared FLOATING-layer primitive (see `src/lib/layers.ts`): portals to
 * `document.body` with `position: fixed` so panels always paint above
 * glass-card stacking contexts, clamps into the viewport, flips above the
 * trigger near the bottom edge, and closes on outside-click / Escape /
 * scroll / resize.
 */
export function FloatingPanel({
  anchor,
  onClose,
  children,
  className,
  triggerGap = 28,
}: FloatingPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Measure on mount, then place: clamp horizontally, flip vertically.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const rawLeft = anchor.left ?? Math.max(0, window.innerWidth - (anchor.right ?? 0) - width);
    const left = Math.min(
      Math.max(rawLeft, MARGIN),
      Math.max(MARGIN, window.innerWidth - width - MARGIN),
    );
    let top = anchor.top;
    if (top + height + MARGIN > window.innerHeight) {
      const flipped = top - height - triggerGap;
      top = flipped >= MARGIN ? flipped : Math.max(MARGIN, window.innerHeight - height - MARGIN);
    }
    setPos({ top, left });
    // Measure once — content size changes (e.g. search results) keep the
    // clamped origin; overflow is handled by max-height below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = (e: Event) => {
      // Scrolling inside the panel itself (e.g. search results) must not close it.
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: pos?.top ?? anchor.top,
        // Pre-measure pass: `left: auto` + `right` shrink-wraps the panel so
        // offsetWidth reflects its natural width instead of a stretched box.
        left: pos?.left ?? anchor.left ?? "auto",
        right: pos || anchor.left != null ? undefined : anchor.right,
        zIndex: LAYER_FLOATING,
        visibility: pos ? "visible" : "hidden",
        maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
        maxWidth: `calc(100vw - ${MARGIN * 2}px)`,
        overflowY: "auto",
      }}
      className={className}
    >
      {children}
    </div>,
    document.body,
  );
}

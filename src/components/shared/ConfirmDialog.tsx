"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { LAYER_MODAL } from "@/lib/layers";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shared MODAL-layer confirm dialog (see `src/lib/layers.ts`): portals to
 * `document.body` so it always paints above glass-card stacking contexts.
 * Themed like the inline editor footers (violet primary action); Escape
 * and backdrop clicks cancel. The only modal confirm in the app — prefer
 * it over `window.confirm` for new destructive/leave confirmations.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
      style={{ zIndex: LAYER_MODAL }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass-card w-full max-w-sm rounded-2xl p-5 shadow-xl"
      >
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{title}</h2>
        <p className="mt-1 text-xs text-gray-500">{body}</p>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-black/5 pt-3 dark:border-white/5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-black/[0.04]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

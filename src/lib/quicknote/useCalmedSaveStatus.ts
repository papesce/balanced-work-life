"use client";

import { useEffect, useRef, useState } from "react";
import type { QuickNoteSaveStatus } from "./types";

/**
 * Calmed view of the quick-note write state, shared by the footer
 * `QuickNoteSaveIndicator` and the panel header dot.
 *
 * While the user is actively typing (`editing`) the display keeps reporting
 * the last steady state and only switches to `editing` if edits stay unsaved
 * beyond UNSAVED_GRACE_MS. Likewise `saving` only paints when a save takes
 * longer than SAVING_GRACE_MS — fast local writes resolve without any
 * visible flash. `error` / `saved` / `idle` always paint immediately.
 */
const UNSAVED_GRACE_MS = 2000;
const SAVING_GRACE_MS = 400;

export function useCalmedSaveStatus(saveStatus: QuickNoteSaveStatus): QuickNoteSaveStatus {
  const [displayStatus, setDisplayStatus] = useState<QuickNoteSaveStatus>(() =>
    saveStatus === "editing" || saveStatus === "saving" ? "idle" : saveStatus,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (saveStatus === "error" || saveStatus === "saved" || saveStatus === "idle") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: stable write states paint immediately, transient ones go through the grace timer below
      setDisplayStatus(saveStatus);
      return;
    }
    const grace = saveStatus === "editing" ? UNSAVED_GRACE_MS : SAVING_GRACE_MS;
    const next = saveStatus;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setDisplayStatus(next);
    }, grace);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [saveStatus]);

  return displayStatus;
}

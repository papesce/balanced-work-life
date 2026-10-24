"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import { FileText } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { QuickAddButton } from "@/components/QuickAddButton";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { UserMenu } from "@/components/UserMenu";
import { GlobalSearchBar } from "@/components/shared/GlobalSearchBar";
import { useQuickNoteData } from "@/contexts/QuickNoteContext";
import { quickNoteBacklogLevel } from "@/lib/quicknote/backlog";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";

const COLLAPSE_BELOW = 1024;

interface AppShellProps {
  children: ReactNode;
  title: string;
  headerActions?: ReactNode;
  headerStartActions?: ReactNode;
  fullWidth?: boolean;
  fillViewport?: boolean;
  onAdd?: (text: string, scheduledDate: string | null) => Promise<unknown>;
}

export function AppShell({
  children,
  title,
  headerActions,
  headerStartActions,
  fullWidth,
  fillViewport,
  onAdd,
}: AppShellProps) {
  const {
    openPanel: openQuickNote,
    pendingNotesCount,
    totalUnreadCount,
    openNotes,
  } = useQuickNoteData();
  // Badge shows the open-note count; its color escalates with both the
  // note pile (>5 open notes) and the actionable task sum (amber at 5+,
  // red at 10+ tasks).
  const backlogLevel = quickNoteBacklogLevel(totalUnreadCount, openNotes.length);
  const badgeColor =
    backlogLevel === "alert"
      ? "bg-red-600"
      : backlogLevel === "warning"
        ? "bg-amber-500"
        : "bg-violet-600";
  const quickNoteLabel =
    totalUnreadCount > 0
      ? `Quick Notes (${totalUnreadCount} task${totalUnreadCount === 1 ? "" : "s"} across ${pendingNotesCount} note${pendingNotesCount === 1 ? "" : "s"}) (⌘⌥N)`
      : "Quick Note (⌘⌥N)";

  const setPrefs = useUiPrefsStore((s) => s.set);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    // Store hydrates synchronously from localStorage (with legacy migration),
    // so getState() already holds the persisted value on first render.
    const stored = useUiPrefsStore.getState().sidebarCollapsed;
    if (stored !== null) return stored;
    return window.innerWidth < COLLAPSE_BELOW;
  });

  const [userOverride, setUserOverride] = useState<boolean | null>(() =>
    useUiPrefsStore.getState().sidebarCollapsed !== null ? true : null,
  );

  useEffect(() => {
    const handleResize = () => {
      if (userOverride !== null) return;
      setCollapsed(window.innerWidth < COLLAPSE_BELOW);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [userOverride]);

  const handleToggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      setPrefs({ sidebarCollapsed: next });
      return next;
    });
    setUserOverride(true);
  }, [setPrefs]);

  return (
    <div className={fillViewport ? "h-dvh overflow-hidden" : "min-h-screen"}>
      <DesktopSidebar collapsed={collapsed} onToggle={handleToggle} />

      <div
        className={`${collapsed ? "md:ml-[64px]" : "md:ml-[184px]"} flex ${
          fillViewport ? "h-full min-h-0" : "min-h-screen"
        } flex-col transition-[margin-left] duration-200 ease-in-out`}
      >
        <header className="glass-card-strong sticky top-0 z-40 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-none border-b border-white/30 px-4 py-2.5 md:px-5 dark:border-white/5">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-gray-500 dark:text-gray-400">
              {title}
            </h1>
            {headerStartActions && (
              <div className="flex flex-wrap items-center gap-1.5">{headerStartActions}</div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <GlobalSearchBar />
            {headerActions}
            {headerActions && (
              <>
                <div className="h-5 w-px bg-black/[0.06] dark:bg-white/[0.08]" />
                <div className="w-1" />
              </>
            )}
            <UserMenu />
          </div>
        </header>

        <main
          className={`flex-1 px-5 py-5 pb-24 md:pb-6 ${
            fillViewport ? "flex min-h-0 flex-col overflow-hidden" : ""
          }`}
        >
          <div
            className={`${fullWidth ? "w-full" : "mx-auto max-w-4xl"} ${
              fillViewport ? "flex min-h-0 flex-1 flex-col" : ""
            }`}
          >
            {children}
          </div>
        </main>
      </div>

      <Navigation className="md:hidden" />
      {onAdd && <QuickAddButton onAdd={onAdd} />}
      <button
        onClick={() => openQuickNote()}
        className="fixed right-6 bottom-24 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/80 text-gray-600 shadow-lg backdrop-blur-lg transition-all hover:bg-white hover:shadow-xl active:scale-95 dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:bg-gray-800"
        title={quickNoteLabel}
        aria-label={
          totalUnreadCount > 0 ? `Open quick notes, ${quickNoteLabel}` : "Open quick notes"
        }
      >
        <FileText size={18} />
        {totalUnreadCount > 0 && (
          <span
            aria-hidden="true"
            className={`absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] leading-none font-bold text-white shadow-md ${badgeColor} ${
              backlogLevel !== "normal" ? "animate-pulse" : ""
            }`}
          >
            {openNotes.length > 99 ? "99+" : openNotes.length}
          </span>
        )}
      </button>
    </div>
  );
}

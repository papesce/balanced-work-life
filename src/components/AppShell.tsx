"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { QuickAddButton } from "@/components/QuickAddButton";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { UserMenu } from "@/components/UserMenu";

const SIDEBAR_KEY = "sidebar-collapsed";
const COLLAPSE_BELOW = 1024;

interface AppShellProps {
  children: ReactNode;
  title: string;
  headerActions?: ReactNode;
  headerStartActions?: ReactNode;
  fullWidth?: boolean;
  onAdd?: (text: string, scheduledDate: string | null) => Promise<unknown>;
}

export function AppShell({
  children,
  title,
  headerActions,
  headerStartActions,
  fullWidth,
  onAdd,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved !== null) return saved === "true";
    return window.innerWidth < COLLAPSE_BELOW;
  });

  const [userOverride, setUserOverride] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(SIDEBAR_KEY) !== null ? true : null;
  });

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
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
    setUserOverride(true);
  }, []);

  return (
    <div className="min-h-screen">
      <DesktopSidebar collapsed={collapsed} onToggle={handleToggle} />

      <div
        className={`${collapsed ? "md:ml-[64px]" : "md:ml-[220px]"} flex min-h-screen flex-col transition-[margin-left] duration-200 ease-in-out`}
      >
        <header className="glass-card-strong sticky top-0 z-40 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-none border-b border-white/30 px-4 py-2.5 md:px-5 dark:border-white/5">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[13px] font-semibold tracking-tight text-gray-500 dark:text-gray-400">
              {title}
            </h1>
            {headerStartActions && (
              <div className="flex flex-wrap items-center gap-1.5">{headerStartActions}</div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
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

        <main className="flex-1 px-5 py-5 pb-24 md:pb-6">
          <div className={fullWidth ? "w-full" : "mx-auto max-w-2xl"}>{children}</div>
        </main>
      </div>

      <Navigation className="md:hidden" />
      {onAdd && <QuickAddButton onAdd={onAdd} />}
    </div>
  );
}

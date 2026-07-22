"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigation } from "@/components/Navigation";
import { QuickAddButton } from "@/components/QuickAddButton";
import { DesktopSidebar } from "@/components/DesktopSidebar";

const SIDEBAR_KEY = "sidebar-collapsed";
const COLLAPSE_BELOW = 1024;

interface AppShellProps {
  children: ReactNode;
  title: string;
  headerActions?: ReactNode;
  fullWidth?: boolean;
  onAdd?: (text: string, scheduledDate: string | null) => Promise<unknown>;
}

export function AppShell({ children, title, headerActions, fullWidth, onAdd }: AppShellProps) {
  const { signOut } = useAuth();

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
      <DesktopSidebar onSignOut={signOut} collapsed={collapsed} onToggle={handleToggle} />

      <div className={`${collapsed ? "md:ml-[64px]" : "md:ml-[220px]"} flex flex-col min-h-screen transition-[margin-left] duration-200 ease-in-out`}>
        <header className="sticky top-0 z-20 glass-card-strong border-b border-white/30 dark:border-white/5 px-5 py-3 flex items-center justify-between rounded-none">
          <h1 className="text-[15px] font-bold text-gray-800 dark:text-gray-200 tracking-tight">{title}</h1>
          <div className="flex items-center gap-3">
            {headerActions}
            <button
              onClick={signOut}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 md:hidden transition-colors"
            >
              Sign Out
            </button>
          </div>
        </header>

        <main className="flex-1 px-5 py-5 pb-24 md:pb-6">
          <div className={fullWidth ? "w-full" : "max-w-2xl mx-auto"}>
            {children}
          </div>
        </main>
      </div>

      <Navigation className="md:hidden" />
      {onAdd && <QuickAddButton onAdd={onAdd} />}
    </div>
  );
}

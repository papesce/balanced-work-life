"use client";

import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigation } from "@/components/Navigation";
import { QuickAddButton } from "@/components/QuickAddButton";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { LifeArea } from "@/lib/types";

interface AppShellProps {
  children: ReactNode;
  title: string;
  headerActions?: ReactNode;
  fullWidth?: boolean;
  onAdd?: (text: string, area: LifeArea, scheduledDate: string | null) => Promise<unknown>;
}

export function AppShell({ children, title, headerActions, fullWidth, onAdd }: AppShellProps) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <DesktopSidebar onSignOut={signOut} />

      <div className="md:ml-[220px] flex flex-col min-h-screen">
        <header className="glass-card-strong border-b border-white/30 dark:border-white/5 px-5 py-3 flex items-center justify-between rounded-none">
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

"use client";

import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigation } from "@/components/Navigation";
import { QuickAddButton } from "@/components/QuickAddButton";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { TimeBucket, BalanceCategory } from "@/lib/types";

interface AppShellProps {
  children: ReactNode;
  title: string;
  headerActions?: ReactNode;
  fullWidth?: boolean;
  onAdd?: (title: string, bucket: TimeBucket, category: BalanceCategory) => Promise<unknown>;
}

export function AppShell({ children, title, headerActions, fullWidth, onAdd }: AppShellProps) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <DesktopSidebar onSignOut={signOut} />

      <div className="md:ml-60 flex flex-col min-h-screen">
        <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          <div className="flex items-center gap-3">
            {headerActions}
            <button
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-700 md:hidden"
            >
              Sign Out
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-20 md:pb-6">
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

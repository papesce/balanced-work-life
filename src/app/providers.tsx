"use client";

import { ReactNode, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PowerSyncContext } from "@powersync/react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { getPowerSync, SupabaseConnector } from "@/lib/powersync";
import { qnLoggingEnabled } from "@/lib/quicknote/log";
import { LaneConfigsProvider } from "@/contexts/LaneConfigsContext";
import { NotesProvider } from "@/contexts/NotesContext";
import { QuickNoteProvider } from "@/contexts/QuickNoteContext";
import type { PowerSyncDatabase } from "@powersync/web";

function PowerSyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const dbRef = useRef<PowerSyncDatabase | null>(null);

  useEffect(() => {
    const db = getPowerSync();
    dbRef.current = db;

    // Log sync-status transitions when debugging (quicknote-debug=1): shows
    // whether the client is connected and whether uploads/downloads flow.
    // Upload failures are always logged by the connector itself — never silent.
    const unregister = db.registerListener({
      statusChanged: (status) => {
        if (!qnLoggingEnabled()) return;
        let detail = "";
        try {
          detail = JSON.stringify(status, (_k, v) => (v instanceof Error ? v.message : v));
        } catch {
          detail = String(status);
        }
        console.log(`[QuickNote:sync] statusChanged: ${detail}`);
      },
    });

    if (session) {
      db.connect(new SupabaseConnector()).catch((err) => {
        console.error(
          "[QuickNote:sync] db.connect() FAILED:",
          err instanceof Error ? err.message : err,
        );
      });
    } else {
      db.disconnect().catch((err) => {
        console.error(
          "[QuickNote:sync] db.disconnect() FAILED:",
          err instanceof Error ? err.message : err,
        );
      });
    }
    return () => unregister();
  }, [session]);

  const db = getPowerSync();
  return <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>;
}

function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    } else if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user && pathname !== "/login") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <LaneConfigsProvider>
      <NotesProvider>
        <QuickNoteProvider>{children}</QuickNoteProvider>
      </NotesProvider>
    </LaneConfigsProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js");
      return;
    }

    // Dev: unregister leftover SWs + clear caches so they don't
    // serve stale pages while the dev server is down.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((reg) => reg.unregister())));
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
  }, []);

  return (
    <AuthProvider>
      <PowerSyncProvider>
        <AuthGuard>{children}</AuthGuard>
      </PowerSyncProvider>
    </AuthProvider>
  );
}

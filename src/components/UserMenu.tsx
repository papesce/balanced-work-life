"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Download, LogOut, Upload, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIdeas } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { buildBackupData, downloadBackup, parseBackupFile } from "@/lib/backup";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { restoreIdeas } = useIdeas();
  const { restoreLinks } = useIdeaLinks();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleExport = async () => {
    if (!user || busy) return;
    setBusy("export");
    setStatus(null);
    try {
      const data = await buildBackupData(user);
      downloadBackup(data);
      setStatus({ type: "success", text: `Exported ${data.ideas.length} ideas and ${data.ideaLinks.length} links.` });
    } catch (err) {
      setStatus({ type: "error", text: `Export failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async (file: File) => {
    if (busy) return;
    setBusy("import");
    setStatus(null);
    try {
      const data = await parseBackupFile(file);
      await restoreIdeas(data.ideas);
      await restoreLinks(data.ideaLinks);
      setStatus({ type: "success", text: `Imported ${data.ideas.length} ideas and ${data.ideaLinks.length} links.` });
    } catch (err) {
      setStatus({ type: "error", text: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setBusy(null);
    }
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
  };

  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null;
  const email = user?.email ?? "";
  const name = (user?.user_metadata?.full_name as string | undefined) || email.split("@")[0] || "Account";
  const nameParts = name.split(" ");
  const initials = `${nameParts[0]?.[0] ?? ""}${nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : ""}`.toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={name}
        className="flex items-center gap-1 rounded-full p-0.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
      >
        <span className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/60 dark:ring-white/10 flex items-center justify-center bg-violet-100 dark:bg-violet-900/40">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : initials ? (
            <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400">{initials}</span>
          ) : (
            <UserIcon size={16} className="text-violet-500 dark:text-violet-400" />
          )}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 glass-card-strong rounded-xl p-1.5 shadow-xl border border-black/5 dark:border-white/5 min-w-[230px]"
          >
            <div className="px-2.5 pt-2 pb-1.5">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{name}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{email}</p>
            </div>
            <div className="mx-1 border-t border-black/5 dark:border-white/5 my-1" />

            <button
              type="button"
              role="menuitem"
              onClick={handleExport}
              disabled={busy !== null}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04] disabled:opacity-50 cursor-pointer"
            >
              {busy === "export" ? (
                <Upload size={14} className="animate-pulse" />
              ) : (
                <Download size={14} />
              )}
              {busy === "export" ? "Exporting..." : "Export backup"}
            </button>

            <label
              role="menuitem"
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer"
            >
              {busy === "import" ? <Upload size={14} className="animate-pulse" /> : <Upload size={14} />}
              {busy === "import" ? "Importing..." : "Import backup"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                disabled={busy !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImport(file);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
            </label>

            <div className="mx-1 border-t border-black/5 dark:border-white/5 my-1" />

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-bold text-red-500 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
            >
              <LogOut size={14} />
              Sign Out
            </button>

            {status && (
              <p
                className={`mx-1 mt-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg ${
                  status.type === "success"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {status.text}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

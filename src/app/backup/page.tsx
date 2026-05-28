"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useIdeas } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { AppShell } from "@/components/AppShell";
import { Idea, IdeaLink } from "@/lib/types";

interface BackupData {
  version: number;
  exportedAt: string;
  ideas: Idea[];
  ideaLinks: IdeaLink[];
}

function isValidBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.ideas) && Array.isArray(obj.ideaLinks);
}

export default function BackupPage() {
  const { user } = useAuth();
  const { restoreIdeas } = useIdeas();
  const { restoreLinks } = useIdeaLinks();

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    setMessage(null);

    try {
      const [ideasRes, linksRes] = await Promise.all([
        supabase.from("ideas").select("*").eq("user_id", user.id),
        supabase.from("idea_links").select("*").eq("user_id", user.id),
      ]);

      if (ideasRes.error) throw ideasRes.error;
      if (linksRes.error) throw linksRes.error;

      const backup: BackupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        ideas: ideasRes.data as Idea[],
        ideaLinks: linksRes.data as IdeaLink[],
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setMessage({ type: "success", text: `Exported ${backup.ideas.length} ideas and ${backup.ideaLinks.length} links.` });
    } catch (err) {
      setMessage({ type: "error", text: `Export failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setMessage(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!isValidBackup(data)) {
        throw new Error("Invalid backup file. Expected JSON with 'ideas' and 'ideaLinks' arrays.");
      }

      await restoreIdeas(data.ideas);
      await restoreLinks(data.ideaLinks);

      setMessage({ type: "success", text: `Imported ${data.ideas.length} ideas and ${data.ideaLinks.length} links.` });
    } catch (err) {
      setMessage({ type: "error", text: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppShell title="Backup">
      <div className="space-y-8">
        {/* Export */}
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Export</h2>
          <p className="text-sm text-gray-500 mb-4">
            Download a JSON snapshot of all your ideas and links.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? "Exporting..." : "Download backup"}
          </button>
        </section>

        {/* Import */}
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Import</h2>
          <p className="text-sm text-gray-500 mb-4">
            Restore from a previously exported JSON file. Existing data is merged (not overwritten).
          </p>
          <label className="inline-block px-4 py-2.5 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            {importing ? "Importing..." : "Choose file..."}
            <input
              type="file"
              accept=".json"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = "";
              }}
            />
          </label>
        </section>

        {/* Feedback */}
        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>
    </AppShell>
  );
}

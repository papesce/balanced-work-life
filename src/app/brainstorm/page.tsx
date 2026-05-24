"use client";

import { useIdeas } from "@/hooks/useIdeas";
import { AppShell } from "@/components/AppShell";
import { IdeaTree } from "@/components/brainstorm/IdeaTree";

export default function BrainstormPage() {
  const ideasHook = useIdeas();

  if (ideasHook.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <AppShell title="Brainstorm">
      <IdeaTree {...ideasHook} />
    </AppShell>
  );
}

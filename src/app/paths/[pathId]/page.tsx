"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PathCanvasProvider, PathView } from "@/components/projects/PathView";

export default function PathPage() {
  const params = useParams<{ pathId: string }>();
  return (
    <AppShell title="Path">
      <div className="mx-auto h-full max-w-7xl p-4">
        <PathCanvasProvider>
          <PathView pathId={params.pathId} fillHeight />
        </PathCanvasProvider>
      </div>
    </AppShell>
  );
}

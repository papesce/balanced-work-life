"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PathEditor } from "@/components/paths/PathEditor";

export default function PathPage() {
  const params = useParams<{ pathId: string }>();
  return (
    <AppShell title="Path">
      <div className="mx-auto h-full max-w-7xl p-4">
        <PathEditor pathId={params.pathId} fillHeight mode="edit" />
      </div>
    </AppShell>
  );
}

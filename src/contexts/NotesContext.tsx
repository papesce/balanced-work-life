"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { DetailsDrawer, type DetailsSection } from "@/components/shared/DetailsDrawer";

interface NotesContextValue {
  openNotes: (ideaId: string, opts?: { section?: DetailsSection }) => void;
  closeNotes: () => void;
}

const NotesContext = createContext<NotesContextValue | null>(null);

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialSection, setInitialSection] = useState<DetailsSection>("notes");

  const openNotes = useCallback((id: string, opts?: { section?: DetailsSection }) => {
    setInitialSection(opts?.section ?? "notes");
    setSelectedId(id);
  }, []);
  const closeNotes = useCallback(() => setSelectedId(null), []);

  return (
    <NotesContext.Provider value={{ openNotes, closeNotes }}>
      {children}
      <DetailsDrawer ideaId={selectedId} initialSection={initialSection} onClose={closeNotes} />
    </NotesContext.Provider>
  );
}

"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { NotesDrawer } from "@/components/shared/NotesDrawer";

interface NotesContextValue {
  openNotes: (ideaId: string) => void;
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

  const openNotes = useCallback((id: string) => setSelectedId(id), []);
  const closeNotes = useCallback(() => setSelectedId(null), []);

  return (
    <NotesContext.Provider value={{ openNotes, closeNotes }}>
      {children}
      <NotesDrawer ideaId={selectedId} onClose={closeNotes} />
    </NotesContext.Provider>
  );
}

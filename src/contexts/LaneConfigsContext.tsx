"use client";

import { createContext, useContext, ReactNode } from "react";
import { useLaneConfigs } from "@/hooks/useLaneConfigs";

type LaneConfigsContextValue = ReturnType<typeof useLaneConfigs>;

const LaneConfigsContext = createContext<LaneConfigsContextValue | null>(null);

export function LaneConfigsProvider({ children }: { children: ReactNode }) {
  const value = useLaneConfigs();
  return <LaneConfigsContext.Provider value={value}>{children}</LaneConfigsContext.Provider>;
}

export function useLaneConfigsContext(): LaneConfigsContextValue {
  const ctx = useContext(LaneConfigsContext);
  if (!ctx) throw new Error("useLaneConfigsContext must be used within LaneConfigsProvider");
  return ctx;
}

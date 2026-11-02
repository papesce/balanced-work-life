"use client";

import { useMemo } from "react";
import { useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { buildEventsQuery } from "@/lib/eventModel";
import { deserializeIdea } from "@/lib/ideaModel";
import { isEvent } from "@/lib/ideaPredicates";
import type { Idea } from "@/lib/types";

export function useEvents(start: string, end: string): { events: Idea[]; loading: boolean } {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const query = buildEventsQuery(userId, start, end);
  const { data: rawRows, isLoading } = useQuery<Record<string, unknown>>(
    userId ? query.sql : "SELECT * FROM ideas WHERE 0",
    userId ? query.params : [],
  );
  const events = useMemo(() => rawRows.map(deserializeIdea).filter(isEvent), [rawRows]);
  return { events, loading: isLoading };
}

import { Idea, LifeArea, getAreasForIdea } from "@/lib/types";
import { Tag } from "@/lib/types";
import { AREA_LABELS } from "./constants";

export interface TimelineEvent {
  id: string;
  title: string;
  startMinute: number;
  durationMinutes: number;
  color?: string;
  category?: string;
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getCategoryColor(areas: LifeArea[]): string | undefined {
  const area = areas[0];
  if (!area) return undefined;
  const colors: Record<string, string> = {
    work: "#DBEAFE",
    health: "#FEE2E2",
    relationships: "#FCE7F3",
    growth: "#FEF3C7",
    finances: "#D1FAE5",
    life: "#EDE9FE",
  };
  return colors[area];
}

function getCategoryLabel(areas: LifeArea[]): string | undefined {
  const area = areas[0];
  if (!area) return undefined;
  return AREA_LABELS[area];
}

export function ideaToTimelineEvent(
  idea: Idea,
  getTagsForIdea: (ideaId: string) => Tag[],
): TimelineEvent {
  const tags = getTagsForIdea(idea.id);
  const areas = getAreasForIdea(tags);
  const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);

  return {
    id: idea.id,
    title: idea.text,
    startMinute: idea.scheduled_time ? parseTimeToMinutes(idea.scheduled_time) : 480,
    durationMinutes: idea.duration_minutes ?? 30,
    color: getCategoryColor(effectiveAreas),
    category: getCategoryLabel(effectiveAreas),
  };
}

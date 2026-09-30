export function formatTimelineDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function getTimelineKicker(date: string, today: string, tomorrow: string): string {
  if (date === today) return "Today";
  if (date === tomorrow) return "Tomorrow";
  return date < today ? "" : "Upcoming";
}

/** Single source of truth for day titles. The date chip is the only place the
 * day number appears; titles carry weekday/month words only.
 * - agenda: weekday long ("Wednesday") + month short ("Sep")
 * - week: weekday short only ("Wed")
 * - detail: full heading ("Wednesday, September 30") */
export type DayTitleVariant = "agenda" | "week" | "detail";

export interface DayTitle {
  weekday: string;
  month: string;
  full: string;
}

export function formatDayTitle(date: string, variant: DayTitleVariant): DayTitle {
  const d = new Date(`${date}T12:00:00`);
  const weekdayLong = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);
  if (variant === "week") {
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
    return { weekday, month: "", full: weekday };
  }
  if (variant === "detail") {
    const full = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(d);
    const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(d);
    return { weekday: weekdayLong, month, full };
  }
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(d);
  return { weekday: weekdayLong, month, full: `${weekdayLong}, ${month}` };
}

/** "1 task", "0 tasks", "N tasks". */
export function formatTaskCount(n: number): string {
  return `${n} task${n === 1 ? "" : "s"}`;
}

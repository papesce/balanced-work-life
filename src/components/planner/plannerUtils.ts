import { toLocalDateString } from "@/lib/dateUtils";

export function offsetDate(base: string, days: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

export function formatDayLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return "Today";
  if (dateStr === offsetDate(todayStr, 1)) return "Tomorrow";
  if (dateStr === offsetDate(todayStr, -1)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", weekday: "short" }).format(
    new Date(dateStr + "T12:00:00"),
  );
}

export function formatTime(raw: string): string {
  const [h, m] = raw.split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "pm" : "am";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return m === "00" ? `${display}${suffix}` : `${display}:${m}${suffix}`;
}

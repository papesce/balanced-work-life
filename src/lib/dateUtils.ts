export type ScheduleGroup = "Today" | "Tomorrow" | "This week" | "Later" | "Unscheduled";

export function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getToday(): string {
  return toLocalDateString(new Date());
}

export function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateString(d);
}

export function getEndOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return toLocalDateString(d);
}

export function getScheduleGroup(scheduledDate: string | null): ScheduleGroup {
  if (!scheduledDate) return "Unscheduled";
  const today = getToday();
  const tomorrow = getTomorrow();
  const endOfWeek = getEndOfWeek();

  if (scheduledDate === today) return "Today";
  if (scheduledDate === tomorrow) return "Tomorrow";
  if (scheduledDate <= endOfWeek) return "This week";
  return "Later";
}

export function isToday(isoTimestamp: string | null): boolean {
  if (!isoTimestamp) return false;
  return isoTimestamp.slice(0, 10) === getToday();
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function getDatesRange(daysBack: number, daysForward: number): string[] {
  const dates: string[] = [];
  for (let i = -daysBack; i <= daysForward; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(toLocalDateString(d));
  }
  return dates;
}

export function isPast(dateStr: string): boolean {
  return dateStr < getToday();
}

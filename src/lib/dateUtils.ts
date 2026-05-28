export type ScheduleGroup = "Today" | "Tomorrow" | "This week" | "Later" | "Unscheduled";

export function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function getEndOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
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

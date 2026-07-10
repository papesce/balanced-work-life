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
  return toLocalDateString(new Date(isoTimestamp)) === getToday();
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

export type WindowType = "day" | "week" | "month" | "year";

export interface DateRange {
  start: string;
  end: string;
}

export interface DateBucket extends DateRange {
  label: string;
}

export function getWeeksInMonth(referenceDate: string): DateBucket[] {
  const ref = new Date(referenceDate + "T00:00:00");
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  // Find the Monday on or before the 1st of the month
  const firstDow = firstOfMonth.getDay(); // 0=Sun
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - (firstDow === 0 ? 6 : firstDow - 1));

  const buckets: DateBucket[] = [];
  const cur = new Date(gridStart);

  while (cur <= lastOfMonth || (cur.getDay() !== 1)) {
    const weekStart = new Date(cur);
    const weekEnd = new Date(cur);
    weekEnd.setDate(cur.getDate() + 6);

    const s = toLocalDateString(weekStart);
    const e = toLocalDateString(weekEnd);
    const label = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    buckets.push({ label, start: s, end: e });

    cur.setDate(cur.getDate() + 7);
    // Stop once we've fully passed the month
    if (cur > lastOfMonth && cur.getDay() === 1) break;
  }

  return buckets;
}

export function getWindowRange(window: WindowType, referenceDate: string): DateRange {
  const ref = new Date(referenceDate + "T00:00:00");
  if (window === "day") {
    return { start: referenceDate, end: referenceDate };
  }
  if (window === "week") {
    const dow = ref.getDay(); // 0=Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: toLocalDateString(monday), end: toLocalDateString(sunday) };
  }
  if (window === "month") {
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { start: toLocalDateString(first), end: toLocalDateString(last) };
  }
  // year
  const first = new Date(ref.getFullYear(), 0, 1);
  const last = new Date(ref.getFullYear(), 11, 31);
  return { start: toLocalDateString(first), end: toLocalDateString(last) };
}

export function getWindowBuckets(window: WindowType, referenceDate: string): DateBucket[] {
  const ref = new Date(referenceDate + "T00:00:00");

  if (window === "day") {
    return [{ label: "All day", start: referenceDate, end: referenceDate }];
  }

  if (window === "week") {
    const { start } = getWindowRange("week", referenceDate);
    const monday = new Date(start + "T00:00:00");
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return dayLabels.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ds = toLocalDateString(d);
      return { label, start: ds, end: ds };
    });
  }

  if (window === "month") {
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const buckets: DateBucket[] = [];
    let cur = new Date(firstDay);
    while (cur <= lastDay) {
      // Week starts on Monday
      const dow = cur.getDay();
      const endOfWeek = new Date(cur);
      const daysToSunday = dow === 0 ? 0 : 7 - dow;
      endOfWeek.setDate(cur.getDate() + daysToSunday);
      const actualEnd = endOfWeek > lastDay ? lastDay : endOfWeek;
      const weekStart = toLocalDateString(cur);
      const weekEnd = toLocalDateString(actualEnd);
      const startD = cur.getDate();
      const endD = actualEnd.getDate();
      buckets.push({
        label: startD === endD ? `${startD}` : `${startD}–${endD}`,
        start: weekStart,
        end: weekEnd,
      });
      const next = new Date(actualEnd);
      next.setDate(actualEnd.getDate() + 1);
      cur = next;
    }
    return buckets;
  }

  // year — 12 monthly buckets
  const year = ref.getFullYear();
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return monthLabels.map((label, i) => {
    const first = new Date(year, i, 1);
    const last = new Date(year, i + 1, 0);
    return { label, start: toLocalDateString(first), end: toLocalDateString(last) };
  });
}

export function getWindowLabel(window: WindowType, referenceDate: string): string {
  const ref = new Date(referenceDate + "T00:00:00");
  if (window === "day") {
    return ref.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  if (window === "week") {
    return ref.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  if (window === "month") {
    return ref.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  return `${ref.getFullYear()}`;
}

export function getMonthCalendarGrid(referenceDate: string): string[] {
  const ref = new Date(referenceDate + "T00:00:00");
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  // Mon=0 … Sun=6 offset for the first day
  const startDow = firstOfMonth.getDay(); // 0=Sun
  const leadingDays = startDow === 0 ? 6 : startDow - 1;

  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - leadingDays);

  // Fill rows until we've covered the last day of month (at least 35 cells, round up to full week)
  const days: string[] = [];
  const cur = new Date(gridStart);
  while (cur <= lastOfMonth || days.length % 7 !== 0) {
    days.push(toLocalDateString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function offsetWindow(window: WindowType, referenceDate: string, delta: number): string {
  const ref = new Date(referenceDate + "T00:00:00");
  if (window === "day") {
    ref.setDate(ref.getDate() + delta);
  } else if (window === "week") {
    ref.setMonth(ref.getMonth() + delta);
  } else if (window === "month") {
    ref.setMonth(ref.getMonth() + delta);
  } else {
    ref.setFullYear(ref.getFullYear() + delta);
  }
  return toLocalDateString(ref);
}

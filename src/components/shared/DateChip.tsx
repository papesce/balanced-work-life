"use client";

interface DateChipProps {
  dayNum: number | string;
  isToday: boolean;
  isSelected: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Shared today/selected date indicator. Three separate states:
 * today = filled violet chip, selected = violet ring, both = filled + ring.
 */
export function DateChip({
  dayNum,
  isToday,
  isSelected,
  size = "sm",
  className = "",
}: DateChipProps) {
  const dims = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";
  const state = isToday
    ? isSelected
      ? "bg-violet-600 text-white ring-2 ring-violet-300 dark:ring-violet-400"
      : "bg-violet-600 text-white"
    : isSelected
      ? "text-violet-600 ring-2 ring-violet-500/50 dark:text-violet-400"
      : "text-gray-500 dark:text-gray-400";
  return (
    <span
      aria-hidden="true"
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold tabular-nums ${dims} ${state} ${className}`}
    >
      {dayNum}
    </span>
  );
}

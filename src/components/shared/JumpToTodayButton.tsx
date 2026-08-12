"use client";

interface JumpToTodayButtonProps {
  onClick: () => void;
  isToday?: boolean;
  label?: string;
}

export function JumpToTodayButton({
  onClick,
  isToday = false,
  label = "Today",
}: JumpToTodayButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`toolbar-btn hidden md:inline-flex ${isToday ? "toolbar-btn--latched" : "toolbar-btn--accent"}`}
      title={isToday ? "Re-center on today" : "Jump to today"}
      aria-pressed={isToday}
    >
      {isToday && <span className="toolbar-btn__dot" aria-hidden="true" />}
      {label}
    </button>
  );
}

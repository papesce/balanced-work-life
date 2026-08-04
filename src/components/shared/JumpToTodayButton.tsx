"use client";

interface JumpToTodayButtonProps {
  onClick: () => void;
  isToday?: boolean;
  label?: string;
}

export function JumpToTodayButton({ onClick, isToday = false, label = "Today" }: JumpToTodayButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isToday}
      className="focus-button"
      title={isToday ? "You're viewing today" : "Jump to today"}
    >
      {label}
    </button>
  );
}

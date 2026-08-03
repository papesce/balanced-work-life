"use client";

interface JumpToTodayButtonProps {
  onClick: () => void;
  isToday?: boolean;
  label?: string;
}

export function JumpToTodayButton({ onClick, isToday = false, label = "Today" }: JumpToTodayButtonProps) {
  if (isToday) return null;
  return (
    <button type="button" onClick={onClick} className="focus-button" title="Jump to today">
      {label}
    </button>
  );
}

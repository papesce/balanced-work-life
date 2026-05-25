"use client";

import { useEffect, useRef } from "react";
import { TimeBucket } from "@/lib/types";

interface PromoteMenuProps {
  onSelect: (bucket: TimeBucket) => void;
  onClose: () => void;
  onViewInPlanner?: () => void;
  hasActiveTask: boolean;
}

const BUCKET_OPTIONS: { value: TimeBucket; label: string }[] = [
  { value: "today", label: "Hacer hoy" },
  { value: "tomorrow", label: "Hacer mañana" },
  { value: "next_week", label: "Agregar a la semana" },
  { value: "backlog", label: "Agregar al backlog" },
];

export function PromoteMenu({ onSelect, onClose, onViewInPlanner, hasActiveTask }: PromoteMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-50 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
    >
      {hasActiveTask && onViewInPlanner && (
        <>
          <button
            onClick={onViewInPlanner}
            className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
          >
            Ver en planner
          </button>
          <div className="border-t border-gray-100 my-1" />
        </>
      )}
      {BUCKET_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

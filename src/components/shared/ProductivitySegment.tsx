"use client";

import { motion } from "framer-motion";
import { PRODUCTIVITY_SIGNALS } from "@/lib/constants";

type SignalValue = "productive" | "lazy" | null;

const OPTIONS: { key: SignalValue; label: string; icon: string }[] = [
  { key: "productive", label: "Productive", icon: PRODUCTIVITY_SIGNALS.productive.icon },
  { key: "lazy", label: "Lazy", icon: PRODUCTIVITY_SIGNALS.lazy.icon },
  { key: null, label: "None", icon: "—" },
];

export function ProductivitySegment({
  value,
  onChange,
  size = "sm",
}: {
  value: SignalValue;
  onChange: (v: SignalValue) => void;
  size?: "sm" | "xs";
}) {
  return (
    <div
      className="flex gap-0.5 rounded-lg bg-black/5 p-0.5 dark:bg-white/5"
      role="radiogroup"
      aria-label="Productivity signal"
    >
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key ?? "none"}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.key)}
            className={`relative rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors ${
              active
                ? "text-gray-800 dark:text-gray-200"
                : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
            }`}
          >
            {active && (
              <motion.div
                layoutId="productivity-segment-bg"
                className="absolute inset-0 rounded-md bg-white shadow-sm dark:bg-white/10"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">
              {opt.icon} {size === "sm" ? opt.label : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

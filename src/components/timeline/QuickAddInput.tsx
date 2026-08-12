"use client";

import { useState } from "react";
import { LifeArea } from "@/lib/types";
import { AREA_LABELS, AREA_ORDER } from "@/lib/constants";
import { areaColors } from "@/styles/tokens";

interface QuickAddInputProps {
  placeholder: string;
  onAdd: (text: string) => Promise<void>;
  /** When set, renders an inline area chip row; selection is single and can be cleared by clicking the active chip. */
  area?: LifeArea | null;
  onAreaChange?: (area: LifeArea | null) => void;
}

export function QuickAddInput({ placeholder, onAdd, area, onAreaChange }: QuickAddInputProps) {
  const [value, setValue] = useState("");
  return (
    <div className="task-input-wrapper">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 border-none bg-transparent py-1.5 text-sm italic outline-none placeholder:text-gray-300 focus:ring-0 dark:placeholder:text-gray-600"
          onKeyDown={async (e) => {
            if (e.key === "Enter" && value.trim()) {
              await onAdd(value.trim());
              setValue("");
            }
          }}
        />
        {onAreaChange && value.trim() && (
          <div
            className="flex shrink-0 items-center gap-1.5 pl-1"
            role="group"
            aria-label="Assign area"
          >
            {AREA_ORDER.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onAreaChange(area === a ? null : a)}
                title={`${AREA_LABELS[a]}${area === a ? " (assigned — click to clear)" : ""}`}
                aria-label={AREA_LABELS[a]}
                aria-pressed={area === a}
                className={`h-2.5 w-2.5 cursor-pointer rounded-full transition-all ${
                  area === a ? "scale-110 opacity-100" : "opacity-30 hover:opacity-90"
                }`}
                style={{
                  background: areaColors[a]?.dot,
                  boxShadow: area === a ? `0 0 0 2px ${areaColors[a]?.dot}` : undefined,
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="input-underline" />
    </div>
  );
}

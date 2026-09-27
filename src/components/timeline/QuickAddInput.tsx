"use client";

import { Idea, LifeArea } from "@/lib/types";
import { AREA_LABELS, AREA_ORDER } from "@/lib/constants";
import { areaColors } from "@/styles/tokens";
import { TaskComposer } from "@/components/shared/TaskComposer";

interface QuickAddInputProps {
  placeholder: string;
  onAdd: (text: string) => Promise<void>;
  /** When set, renders an inline area chip row; selection is single and can be cleared by clicking the active chip. */
  area?: LifeArea | null;
  onAreaChange?: (area: LifeArea | null) => void;
  /** Opt-in duplicate warning: open ideas to suggest while typing. */
  suggestFrom?: Idea[];
}

export function QuickAddInput({
  placeholder,
  onAdd,
  area,
  onAreaChange,
  suggestFrom,
}: QuickAddInputProps) {
  return (
    <TaskComposer
      variant="underline"
      placeholder={placeholder}
      onCreate={onAdd}
      suggestFrom={suggestFrom}
      trailing={
        onAreaChange ? (
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
        ) : undefined
      }
    />
  );
}

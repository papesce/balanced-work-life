"use client";

import { useState } from "react";
import type { Idea, IdeaType } from "@/lib/types";
import { TYPE_BADGE } from "@/lib/constants";
import { TypePicker } from "@/components/brainstorm/TypePicker";
import { QuickAddInput } from "@/components/timeline/QuickAddInput";

interface RootAddInputProps {
  label: string;
  onAdd: (text: string, type?: IdeaType) => Promise<void>;
  suggestFrom?: Idea[];
}

/** Column footer: type badge picker + quick-add input for root-level ideas. */
export function RootAddInput({ label, onAdd, suggestFrom }: RootAddInputProps) {
  const [rootType, setRootType] = useState<IdeaType>("task");
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [typePickerPos, setTypePickerPos] = useState<{ top: number; left: number } | null>(null);
  const badge = TYPE_BADGE[rootType];

  return (
    <div className="border-t border-black/[0.02] px-4 py-2 dark:border-white/[0.02]">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTypePickerPos({ top: rect.bottom + 4, left: rect.left });
              setShowTypePicker(!showTypePicker);
            }}
            className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${badge.className} cursor-pointer transition-opacity hover:opacity-80`}
          >
            {badge.label}
          </button>
          {showTypePicker && typePickerPos && (
            <TypePicker
              current={rootType}
              onSelect={(type) => {
                setRootType(type ?? "task");
                setShowTypePicker(false);
              }}
              onClose={() => setShowTypePicker(false)}
              position={typePickerPos}
            />
          )}
        </div>
        <QuickAddInput
          placeholder={`+ Add to ${label}...`}
          onAdd={async (text) => {
            await onAdd(text, rootType);
          }}
          suggestFrom={suggestFrom}
        />
      </div>
    </div>
  );
}

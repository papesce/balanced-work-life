"use client";

import { useRef } from "react";

interface QuickAddInputProps {
  placeholder: string;
  onAdd: (text: string) => Promise<void>;
}

export function QuickAddInput({ placeholder, onAdd }: QuickAddInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="task-input-wrapper">
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        className="w-full bg-transparent border-none text-sm py-1.5 focus:ring-0 placeholder:text-gray-300 dark:placeholder:text-gray-600 italic outline-none"
        onKeyDown={async (e) => {
          const input = ref.current;
          if (e.key === "Enter" && input?.value.trim()) {
            await onAdd(input.value.trim());
            input.value = "";
          }
        }}
      />
      <div className="input-underline" />
    </div>
  );
}

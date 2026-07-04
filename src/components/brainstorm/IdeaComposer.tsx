"use client";

import { KeyboardEvent, useState } from "react";

interface IdeaComposerProps {
  depth?: number;
  placeholder: string;
  onCreate: (text: string) => Promise<void>;
  onDismiss?: () => void;
}

export function IdeaComposer({ depth = 0, placeholder, onCreate, onDismiss }: IdeaComposerProps) {
  const [text, setText] = useState("");

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    await onCreate(trimmed);
  };

  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (text) {
        setText("");
      } else if (onDismiss) {
        onDismiss();
      }
    }
  };

  return (
    <div style={{ paddingLeft: depth > 0 ? 20 * depth : 0 }} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1 py-1 px-1 rounded-md bg-indigo-50/40 dark:bg-indigo-500/10">
        <span className="w-5 h-5 flex-shrink-0" />
        <span className="w-[14px] flex-shrink-0 text-gray-300 dark:text-gray-500 text-sm select-none">+</span>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm px-2 py-0.5 border border-dashed border-indigo-200 dark:border-indigo-500/30 rounded outline-none focus:border-indigo-500 focus:border-solid min-w-0 bg-white dark:bg-transparent text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

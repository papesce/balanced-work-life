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
      <div className="flex items-center gap-1 rounded-md bg-indigo-50/40 px-1 py-1 dark:bg-indigo-500/10">
        <span className="h-5 w-5 flex-shrink-0" />
        <span className="w-[14px] flex-shrink-0 text-sm text-gray-300 select-none dark:text-gray-500">
          +
        </span>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded border border-dashed border-indigo-200 bg-white px-2 py-0.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-solid focus:border-indigo-500 dark:border-indigo-500/30 dark:bg-transparent dark:text-gray-200 dark:placeholder:text-gray-500"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

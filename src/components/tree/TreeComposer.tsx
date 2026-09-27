"use client";

import type { ReactNode } from "react";
import { TaskComposer } from "@/components/shared/TaskComposer";
import type { Idea } from "@/lib/types";

interface TreeComposerProps {
  depth?: number;
  /** Pixels of indentation per depth level (matches the tree rows). */
  indentSize?: number;
  placeholder: string;
  /** Optional content rendered before the "+" (e.g. a type picker pill). */
  leading?: ReactNode;
  onCreate: (text: string) => Promise<void> | void;
  onDismiss?: () => void;
  /** Opt-in duplicate warning: open ideas to suggest while typing. */
  suggestFrom?: Idea[];
}

/** Thin alias over the shared TaskComposer (tree variant). */
export function TreeComposer(props: TreeComposerProps) {
  return <TaskComposer variant="tree" {...props} />;
}

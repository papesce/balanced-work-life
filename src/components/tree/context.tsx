"use client";

import { createContext, useContext } from "react";
import type { DropZone, TreeController, TreeItem, TreeOptions, TreeUiState } from "./types";

export interface TreeDndState {
  activeItemId: string | null;
  overItemId: string | null;
  zone: DropZone | null;
  targetDepth: number | null;
}

interface TreeContextValue<T extends TreeItem> {
  controller: TreeController<T>;
  ui: TreeUiState;
  options: TreeOptions<T>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const TreeContext = createContext<TreeContextValue<any> | null>(null);

const TreeDndStateContext = createContext<TreeDndState>({
  activeItemId: null,
  overItemId: null,
  zone: null,
  targetDepth: null,
});

export const TreeProvider = TreeContext.Provider;
export const TreeDndStateProvider = TreeDndStateContext.Provider;

export function useTree<T extends TreeItem>(): TreeContextValue<T> {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error("Tree components must be rendered inside <TreeView>");
  return ctx as TreeContextValue<T>;
}

export function useTreeDndState(): TreeDndState {
  return useContext(TreeDndStateContext);
}

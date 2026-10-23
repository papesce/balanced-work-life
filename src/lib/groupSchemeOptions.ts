import type { ClassificationScheme } from "@/lib/types";

export interface GroupSchemeOption {
  key: string;
  label: string;
}

/**
 * Schemes ordered by `sort_order`, mapped to the flat `{ key, label }` options
 * used by the detail TASKS "Group" select.
 */
export function getGroupSchemeOptions(schemes: ClassificationScheme[]): GroupSchemeOption[] {
  return [...schemes]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({ key: s.key, label: s.label }));
}

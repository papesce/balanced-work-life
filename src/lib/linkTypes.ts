import type { LinkType } from "@/lib/types";

/** Shared link-type options — single source of truth reused by LinkPanel, GraphView, path editor. */
export const LINK_TYPES: { value: LinkType; label: string }[] = [
  { value: "unblocks", label: "Unblocks" },
  { value: "contributes_to", label: "Contributes to" },
  { value: "depends_on", label: "Depends on" },
  { value: "related_to", label: "Related to" },
  { value: "part_of", label: "Part of" },
  { value: "path_of", label: "Associated with" },
];

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  unblocks: "unblocks",
  contributes_to: "contributes to",
  depends_on: "depends on",
  related_to: "related",
  part_of: "part of",
  path_of: "associated with",
};

/** Canvas edge styling per link type so the relationship kind is visible. */
export const LINK_EDGE_STYLE: Record<
  LinkType,
  { stroke: string; dashed?: boolean; animated?: boolean }
> = {
  depends_on: { stroke: "#8b5cf6" },
  unblocks: { stroke: "#10b981", animated: true },
  contributes_to: { stroke: "#3b82f6" },
  part_of: { stroke: "#f59e0b" },
  related_to: { stroke: "#9ca3af", dashed: true },
  path_of: { stroke: "#8b5cf6", dashed: true },
};

export const PATH_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const PATH_STATUS_PRESENTATION: Record<string, { label: string; className: string }> = {
  open: {
    label: "Open",
    className:
      "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-200",
  },
  paused: {
    label: "Paused",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  },
  completed: {
    label: "Done",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200",
  },
};

const FALLBACK_PRESENTATION = {
  label: "Unknown",
  className:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function normalizePathStatus(status: string): string {
  return status === "draft" ? "open" : status;
}

export function toStoredPathStatus(status: string): string {
  return status === "open" ? "draft" : status;
}

export function getPathStatusPresentation(status: string): {
  label: string;
  className: string;
} {
  const normalized = normalizePathStatus(status);
  return (
    PATH_STATUS_PRESENTATION[normalized] ?? {
      ...FALLBACK_PRESENTATION,
      label: status || FALLBACK_PRESENTATION.label,
    }
  );
}

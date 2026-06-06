export const radius = {
  card: 20,
  sidebar: 28,
  pill: 9999,
  sm: 12,
} as const;

export const glass = {
  light: {
    background: "rgba(255, 255, 255, 0.65)",
    backdropFilter: "blur(20px) saturate(180%)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    shadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
  },
  dark: {
    background: "rgba(255, 255, 255, 0.08)",
    backdropFilter: "blur(20px) saturate(180%)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    shadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
  },
} as const;

export const areaColors: Record<string, { bg: string; text: string; dot: string }> = {
  life: { bg: "rgba(139, 92, 246, 0.12)", text: "#7c3aed", dot: "#8B5CF6" },
  work: { bg: "rgba(59, 130, 246, 0.12)", text: "#2563eb", dot: "#4F6BED" },
  finances: { bg: "rgba(16, 185, 129, 0.12)", text: "#059669", dot: "#10B981" },
  relationships: { bg: "rgba(244, 63, 94, 0.12)", text: "#e11d48", dot: "#EC4899" },
  health: { bg: "rgba(239, 68, 68, 0.12)", text: "#dc2626", dot: "#EF4444" },
  growth: { bg: "rgba(245, 158, 11, 0.12)", text: "#d97706", dot: "#F59E0B" },
};

export const areaDarkColors: Record<string, { bg: string; text: string }> = {
  life: { bg: "rgba(139, 92, 246, 0.2)", text: "#a78bfa" },
  work: { bg: "rgba(59, 130, 246, 0.2)", text: "#93c5fd" },
  finances: { bg: "rgba(16, 185, 129, 0.2)", text: "#6ee7b7" },
  relationships: { bg: "rgba(244, 63, 94, 0.2)", text: "#fda4af" },
  health: { bg: "rgba(239, 68, 68, 0.2)", text: "#fca5a5" },
  growth: { bg: "rgba(245, 158, 11, 0.2)", text: "#fde68a" },
};

export const typography = {
  fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
  body: { size: "14px", weight: 400 },
  taskTitle: { size: "14px", weight: 500 },
  dayHeader: { size: "22px", weight: 700 },
  dayLabel: { size: "10px", weight: 600, letterSpacing: "0.12em" },
  areaTag: { size: "10px", weight: 600 },
  wordmark: { size: "18px", weight: 700 },
  subtitle: { size: "11px", letterSpacing: "0.08em" },
} as const;

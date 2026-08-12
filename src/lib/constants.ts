import {
  Briefcase,
  Check,
  Coins,
  Compass,
  Heart,
  Pause,
  Play,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { IdeaStatus, LifeArea } from "@/lib/types";

export const AREA_ORDER: LifeArea[] = [
  "work",
  "health",
  "relationships",
  "growth",
  "finances",
  "life",
];

export const AREA_LABELS: Record<LifeArea, string> = {
  work: "Work",
  health: "Health",
  relationships: "Relationships",
  growth: "Growth",
  finances: "Finances",
  life: "Life",
};

export const AREA_ICONS: Record<LifeArea, React.ElementType> = {
  work: Briefcase,
  health: Heart,
  relationships: Users,
  growth: Sparkles,
  finances: Coins,
  life: Compass,
};

export const AREA_DOT_COLORS: Record<LifeArea, string> = {
  work: "bg-blue-500",
  health: "bg-red-500",
  relationships: "bg-pink-500",
  growth: "bg-amber-500",
  finances: "bg-emerald-500",
  life: "bg-violet-500",
};

export const AREA_TEXT_COLORS: Record<LifeArea, string> = {
  work: "text-blue-700 dark:text-blue-300",
  health: "text-red-700 dark:text-red-300",
  relationships: "text-pink-700 dark:text-pink-300",
  growth: "text-amber-700 dark:text-amber-300",
  finances: "text-emerald-700 dark:text-emerald-300",
  life: "text-violet-700 dark:text-violet-300",
};

export const STATUS_CONFIG: Record<
  IdeaStatus,
  { label: string; textClass: string; hex: string; bg: string; icon: React.ElementType | null }
> = {
  inbox: {
    label: "Inbox",
    textClass: "text-gray-400",
    hex: "#9ca3af",
    bg: "rgba(0,0,0,0.05)",
    icon: null,
  },
  planned: {
    label: "Planned",
    textClass: "text-sky-500",
    hex: "#0ea5e9",
    bg: "rgba(14,165,233,0.1)",
    icon: null,
  },
  scheduled: {
    label: "Scheduled",
    textClass: "text-blue-500",
    hex: "#3b82f6",
    bg: "rgba(59,130,246,0.1)",
    icon: null,
  },
  in_progress: {
    label: "In Progress",
    textClass: "text-amber-500",
    hex: "#d97706",
    bg: "rgba(217,119,6,0.1)",
    icon: Play,
  },
  paused: {
    label: "Paused",
    textClass: "text-orange-400",
    hex: "#f97316",
    bg: "rgba(249,115,22,0.1)",
    icon: Pause,
  },
  completed: {
    label: "Completed",
    textClass: "text-violet-600",
    hex: "#7c3aed",
    bg: "rgba(124,58,237,0.1)",
    icon: Check,
  },
  cancelled: {
    label: "Cancelled",
    textClass: "text-red-500",
    hex: "#ef4444",
    bg: "rgba(239,68,68,0.1)",
    icon: X,
  },
  archived: {
    label: "Archived",
    textClass: "text-gray-400",
    hex: "#9ca3af",
    bg: "rgba(0,0,0,0.05)",
    icon: null,
  },
  deferred: {
    label: "Deferred",
    textClass: "text-amber-600",
    hex: "#d97706",
    bg: "rgba(217,119,6,0.1)",
    icon: null,
  },
};

export const DEFAULT_TARGETS: Record<LifeArea, number> = {
  work: 35,
  health: 15,
  relationships: 15,
  growth: 15,
  finances: 10,
  life: 10,
};

export const LOCAL_STORAGE_TARGETS_KEY = "daily-planner-area-targets";

export const SCHEDULE_HOURS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

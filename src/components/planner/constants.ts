"use client";

import { Briefcase, Heart, Users, Sparkles, Coins, Compass } from "lucide-react";
import { LifeArea } from "@/lib/types";

export const AREA_ORDER: LifeArea[] = ["work", "health", "relationships", "growth", "finances", "life"];

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
  "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00",
  "17:00", "18:00", "19:00", "20:00", "21:00", "22:00",
];

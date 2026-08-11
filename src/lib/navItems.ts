import {
  LayoutDashboard,
  CalendarDays,
  Telescope,
  Tags,
  Activity,
} from "lucide-react";

export const navItems = [
  { href: "/", label: "Daily Planner", icon: LayoutDashboard },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/horizon", label: "Horizon", icon: Telescope },
  { href: "/balance", label: "Balance", icon: Activity },
  { href: "/settings/tags", label: "Tags", icon: Tags },
];

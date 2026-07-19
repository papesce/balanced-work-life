import {
  LayoutDashboard,
  CalendarDays,
  Telescope,
  BrainCircuit,
  CloudDownload,
  Tags,
  Activity,
  History,
} from "lucide-react";

export const navItems = [
  { href: "/", label: "Daily Planner", icon: LayoutDashboard },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/deferred", label: "Deferred", icon: History },
  { href: "/horizon", label: "Horizon", icon: Telescope },
  { href: "/brainstorm", label: "Brainstorm", icon: BrainCircuit },
  { href: "/balance", label: "Balance", icon: Activity },
  { href: "/settings/tags", label: "Tags", icon: Tags },
  { href: "/backup", label: "Backup", icon: CloudDownload },
];

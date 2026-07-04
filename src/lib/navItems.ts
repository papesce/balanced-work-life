import {
  LayoutDashboard,
  CalendarDays,
  BrainCircuit,
  CloudDownload,
  Tags,
  Activity,
} from "lucide-react";

export const navItems = [
  { href: "/", label: "Daily Planner", icon: LayoutDashboard },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/brainstorm", label: "Brainstorm", icon: BrainCircuit },
  { href: "/balance", label: "Balance", icon: Activity },
  { href: "/settings/tags", label: "Tags", icon: Tags },
  { href: "/backup", label: "Backup", icon: CloudDownload },
];

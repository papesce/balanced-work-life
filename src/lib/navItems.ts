import {
  LayoutDashboard,
  CalendarDays,
  Telescope,
  BrainCircuit,
  Activity,
  FolderKanban,
} from "lucide-react";

export const navItems = [
  { href: "/", label: "Daily Planner", icon: LayoutDashboard },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/horizon", label: "Horizon", icon: Telescope },
  { href: "/brainstorm", label: "Brainstorm", icon: BrainCircuit },
  { href: "/balance", label: "Balance", icon: Activity },
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

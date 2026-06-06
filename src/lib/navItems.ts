import {
  LayoutDashboard,
  CalendarDays,
  BrainCircuit,
  CloudDownload,
} from "lucide-react";

export const navItems = [
  { href: "/", label: "Today", icon: LayoutDashboard },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/brainstorm", label: "Brainstorm", icon: BrainCircuit },
  { href: "/backup", label: "Backup", icon: CloudDownload },
];

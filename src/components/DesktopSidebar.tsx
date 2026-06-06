"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { navItems } from "@/lib/navItems";

interface DesktopSidebarProps {
  onSignOut: () => void;
}

export function DesktopSidebar({ onSignOut }: DesktopSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col md:w-[220px] md:fixed md:inset-y-0 glass-sidebar z-30">
      <div className="px-5 py-6">
        <h1 className="text-lg font-bold text-gray-800 tracking-tight">
          Balanced
        </h1>
        <p className="text-[11px] text-gray-400 tracking-[0.08em] uppercase mt-0.5">
          Work & Life
        </p>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1 relative">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                active
                  ? "text-violet-700 font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="nav-active-bg"
                  className="absolute inset-0 rounded-xl bg-violet-50/80"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-3">
                <Icon
                  size={18}
                  strokeWidth={1.5}
                  className={active ? "text-violet-600" : "text-gray-400"}
                />
                <span>{item.label}</span>
              </span>
              {active && (
                <motion.div
                  layoutId="nav-active-bar"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-violet-600 rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}

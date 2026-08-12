"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { navItems } from "@/lib/navItems";
import { APP_VERSION } from "@/lib/version";
import { PanelLeftClose } from "lucide-react";

interface DesktopSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function DesktopSidebar({ collapsed, onToggle }: DesktopSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`glass-sidebar z-30 hidden transition-[width] duration-200 ease-in-out md:fixed md:inset-y-0 md:flex md:flex-col ${
        collapsed ? "md:w-[64px]" : "md:w-[220px]"
      }`}
    >
      {/* BRANDING + TOGGLE */}
      <div
        className={`border-b border-black/5 py-5 dark:border-white/5 ${collapsed ? "flex justify-center px-2" : "flex items-start justify-between px-5"}`}
      >
        {collapsed ? (
          <button
            onClick={onToggle}
            title="Expand sidebar"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-violet-100 transition-colors hover:bg-violet-200 dark:bg-violet-900/30 dark:hover:bg-violet-800/40"
          >
            <span className="text-sm font-bold text-violet-600 dark:text-violet-400">B</span>
          </button>
        ) : (
          <>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-gray-800 dark:text-gray-200">
                Balanced
              </h1>
              <p className="mt-0.5 text-[11px] tracking-[0.08em] text-gray-400 uppercase dark:text-gray-500">
                Work & Life
              </p>
              <p className="mt-1.5 text-[10px] text-gray-300 select-none dark:text-gray-600">
                v{APP_VERSION}
              </p>
            </div>
            <button
              onClick={onToggle}
              title="Collapse sidebar"
              className="mt-1 cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <PanelLeftClose size={16} />
            </button>
          </>
        )}
      </div>

      {/* NAV LINKS */}
      <nav className={`relative flex-1 space-y-1 py-2 ${collapsed ? "px-2" : "px-3"}`}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center rounded-xl text-sm transition-colors ${
                collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
              } ${
                active
                  ? "font-medium text-violet-700 dark:text-violet-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              <AnimatePresence>
                {active && (
                  <>
                    <motion.div
                      key="bg"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="absolute inset-0 rounded-xl bg-violet-50/80 dark:bg-violet-500/15"
                    />
                    <motion.div
                      key="bar"
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      exit={{ opacity: 0, scaleY: 0 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-full bg-violet-600 dark:bg-violet-500"
                    />
                  </>
                )}
              </AnimatePresence>
              <span className="relative z-10 flex items-center gap-3">
                <Icon
                  size={18}
                  strokeWidth={1.5}
                  className={
                    active
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-gray-400 dark:text-gray-500"
                  }
                />
                {!collapsed && <span>{item.label}</span>}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

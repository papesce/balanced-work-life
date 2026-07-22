"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { navItems } from "@/lib/navItems";
import { APP_VERSION } from "@/lib/version";
import { PanelLeftClose, LogOut } from "lucide-react";

interface DesktopSidebarProps {
  onSignOut: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function DesktopSidebar({ onSignOut, collapsed, onToggle }: DesktopSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 glass-sidebar z-30 transition-[width] duration-200 ease-in-out ${
        collapsed ? "md:w-[64px]" : "md:w-[220px]"
      }`}
    >
      {/* BRANDING + TOGGLE */}
      <div className={`py-5 border-b border-black/5 dark:border-white/5 ${collapsed ? "px-2 flex justify-center" : "px-5 flex items-start justify-between"}`}>
        {collapsed ? (
          <button
            onClick={onToggle}
            title="Expand sidebar"
            className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center hover:bg-violet-200 dark:hover:bg-violet-800/40 transition-colors cursor-pointer"
          >
            <span className="text-sm font-bold text-violet-600 dark:text-violet-400">B</span>
          </button>
        ) : (
          <>
            <div>
              <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 tracking-tight">
                Balanced
              </h1>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 tracking-[0.08em] uppercase mt-0.5">
                Work & Life
              </p>
              <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1.5 select-none">
                v{APP_VERSION}
              </p>
            </div>
            <button
              onClick={onToggle}
              title="Collapse sidebar"
              className="mt-1 p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <PanelLeftClose size={16} />
            </button>
          </>
        )}
      </div>

      {/* NAV LINKS */}
      <nav className={`flex-1 py-2 space-y-1 relative ${collapsed ? "px-2" : "px-3"}`}>
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
                  ? "text-violet-700 dark:text-violet-400 font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
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
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-violet-600 dark:bg-violet-500 rounded-full"
                    />
                  </>
                )}
              </AnimatePresence>
              <span className="relative z-10 flex items-center gap-3">
                <Icon
                  size={18}
                  strokeWidth={1.5}
                  className={active ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-gray-500"}
                />
                {!collapsed && <span>{item.label}</span>}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className={`border-t border-black/5 dark:border-white/5 ${collapsed ? "px-2 py-3" : "px-3 py-4"}`}>
        <button
          onClick={onSignOut}
          title={collapsed ? "Sign Out" : undefined}
          className={`w-full flex items-center rounded-xl text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
            collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2"
          }`}
        >
          <LogOut size={16} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

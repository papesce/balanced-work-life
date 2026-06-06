"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/navItems";

interface NavigationProps {
  className?: string;
}

export function Navigation({ className = "" }: NavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 glass-card z-40 rounded-none border-t border-b-0 border-x-0 ${className}`}
    >
      <div className="flex justify-around items-center h-14">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                active
                  ? "text-violet-600 dark:text-violet-400"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              }`}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2 : 1.5}
                className={active ? "text-violet-600 dark:text-violet-400" : ""}
              />
              <span className="text-[10px] font-semibold tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

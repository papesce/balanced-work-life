"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/navItems";
import { APP_VERSION } from "@/lib/version";

interface NavigationProps {
  className?: string;
}

export function Navigation({ className = "" }: NavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className={`glass-card fixed right-0 bottom-0 left-0 z-40 rounded-none border-x-0 border-t border-b-0 ${className}`}
    >
      <div className="flex h-14 items-center justify-around">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 transition-colors ${
                active
                  ? "text-violet-600 dark:text-violet-400"
                  : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
              }`}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2 : 1.5}
                className={active ? "text-violet-600 dark:text-violet-400" : ""}
              />
              <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
      <p className="pb-1 text-center text-[9px] text-gray-300 select-none dark:text-gray-600">
        v{APP_VERSION}
      </p>
    </nav>
  );
}

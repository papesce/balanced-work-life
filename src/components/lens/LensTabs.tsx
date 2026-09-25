"use client";

export interface LensTab {
  key: string;
  label: string;
}

interface LensTabsProps {
  tabs: LensTab[];
  activeKey: string;
  onChange: (key: string) => void;
  /** Optional prefix label, e.g. "Group by:". */
  label?: string;
  ariaLabel?: string;
}

/** Shared lens switcher (Horizon classification lenses, Projects grouping). */
export function LensTabs({ tabs, activeKey, onChange, label, ariaLabel }: LensTabsProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? "Classification lens"}
      className="flex flex-wrap items-center gap-1 rounded-xl bg-black/[0.03] p-1 dark:bg-white/[0.04]"
    >
      {label && <span className="px-2 text-[11px] font-semibold text-gray-400">{label}</span>}
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={t.key === activeKey}
          onClick={() => onChange(t.key)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
            t.key === activeKey
              ? "bg-violet-100/80 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
              : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

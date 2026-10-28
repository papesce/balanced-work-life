"use client";

import type { ReactNode } from "react";
import type { Ref } from "react";

export function StatusPill({
  children,
  className,
  ariaLabel,
  onClick,
  id,
  buttonRef,
  ariaControls,
  ariaHasPopup,
  ariaExpanded,
}: {
  children: ReactNode;
  className: string;
  ariaLabel: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  id?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  ariaControls?: string;
  ariaHasPopup?: "menu";
  ariaExpanded?: boolean;
}) {
  return (
    <button
      id={id}
      ref={buttonRef}
      type="button"
      aria-label={ariaLabel}
      aria-controls={ariaControls}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      onClick={onClick}
      className={`inline-flex min-h-6 items-center justify-center rounded-full border px-2 py-0.5 text-xs leading-tight whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500 ${className}`}
    >
      {children}
    </button>
  );
}

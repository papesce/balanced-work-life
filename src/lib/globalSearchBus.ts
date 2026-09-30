"use client";

/**
 * One-way bridge to the global search bar (which owns its query state).
 * Lets out-of-header UI (e.g. quick-note text selections) populate and
 * focus the search field. Window events cross the panel portal boundary
 * without context plumbing.
 */

const GLOBAL_SEARCH_EVENT = "balanced-work-life:global-search";

export function requestGlobalSearch(text: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(GLOBAL_SEARCH_EVENT, { detail: text }));
}

export function subscribeGlobalSearch(handler: (text: string) => void): () => void {
  const listener = (e: Event) => {
    handler((e as CustomEvent<string>).detail ?? "");
  };
  window.addEventListener(GLOBAL_SEARCH_EVENT, listener);
  return () => window.removeEventListener(GLOBAL_SEARCH_EVENT, listener);
}

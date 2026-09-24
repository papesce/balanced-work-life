"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Telescope,
  BrainCircuit,
  FolderKanban,
  Target,
  Search,
  CornerDownLeft,
  Eye,
  X,
} from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import {
  DONE_STATUSES,
  formatScheduleLabel,
  getPathLabel,
  getTypeLabel,
  searchIdeas,
} from "@/lib/ideaSearch";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/constants";
import { TYPE_COLORS } from "@/components/brainstorm/ideaNodeSlots";
import {
  getRevealHref,
  getRevealOptions,
  getSmartRevealView,
  getRevealLabel,
  type RevealView,
} from "@/lib/reveal";

const VIEW_ICON: Record<RevealView, React.ReactNode> = {
  planner: <LayoutDashboard size={12} strokeWidth={1.5} />,
  timeline: <CalendarDays size={12} strokeWidth={1.5} />,
  horizon: <Telescope size={12} strokeWidth={1.5} />,
  brainstorm: <BrainCircuit size={12} strokeWidth={1.5} />,
  projects: <FolderKanban size={12} strokeWidth={1.5} />,
  goals: <Target size={12} strokeWidth={1.5} />,
};

function pathnameToView(pathname: string): RevealView | null {
  if (pathname === "/") return "planner";
  if (pathname === "/timeline") return "timeline";
  if (pathname === "/horizon") return "horizon";
  if (pathname === "/brainstorm") return "brainstorm";
  if (pathname === "/projects") return "projects";
  if (pathname === "/goals") return "goals";
  return null;
}

export function GlobalSearchBar() {
  const { ideas } = useIdeas({ scope: "all" });
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [includeDone, setIncludeDone] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(rawQuery);
      setActiveIndex(0);
      setExpandedId(null);
    }, 150);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // ⌘K / Ctrl+K + "/" to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
        setExpandedId(null);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setExpandedId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const ideasById = useMemo(() => new Map(ideas.map((i) => [i.id, i])), [ideas]);
  const results = useMemo(
    () => searchIdeas(ideas, query, { includeDone, limit: 10 }),
    [ideas, query, includeDone],
  );

  const currentView = pathnameToView(pathname);

  const openInCurrentView = (ideaId: string) => {
    const idea = ideas.find((i) => i.id === ideaId);
    if (idea && currentView) {
      // Archived ideas can never render on date views — send to the smart view.
      if (idea.status === "archived" && (currentView === "planner" || currentView === "timeline")) {
        router.push(getRevealHref(getSmartRevealView(idea, ideas), idea, ideas));
      } else if (
        (currentView === "planner" || currentView === "timeline") &&
        !idea.scheduled_date
      ) {
        // Unscheduled: keep the user's current date, just highlight.
        const params = new URLSearchParams(searchParams.toString());
        params.set("highlight", ideaId);
        router.push(`${pathname}?${params.toString()}`);
      } else {
        // Context-aware: sets ?date= / ?lens=&horizon= / ?projectId= / ?goalId=
        // so the target is actually rendered before the highlight effect runs.
        // From horizon, preserve the active lens.
        const lens = currentView === "horizon" ? searchParams.get("lens") : null;
        router.push(getRevealHref(currentView, idea, ideas, undefined, lens));
      }
    } else if (idea) {
      router.push(getRevealHref(getSmartRevealView(idea, ideas), idea, ideas));
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set("highlight", ideaId);
      router.push(`${pathname}?${params.toString()}`);
    }
    setOpen(false);
    setRawQuery("");
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative w-40 sm:w-52 md:w-64 lg:w-72">
      <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white/60 px-2 py-1.5 text-sm focus-within:ring-1 focus-within:ring-violet-500/40 dark:border-white/10 dark:bg-gray-800/60">
        <Search size={14} className="shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={rawQuery}
          placeholder="Search ideas…"
          aria-label="Search ideas"
          onChange={(e) => {
            setRawQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => (i - 1 + results.length) % results.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const idea = results[activeIndex];
              if (idea) {
                if (expandedId === idea.id) setExpandedId(null);
                else openInCurrentView(idea.id);
              }
            } else if (e.key === "ArrowRight") {
              const idea = results[activeIndex];
              if (idea && expandedId !== idea.id) {
                e.preventDefault();
                setExpandedId(idea.id);
              }
            }
          }}
          className="w-full bg-transparent text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-200 dark:placeholder:text-gray-500"
        />
        {rawQuery ? (
          <button
            aria-label="Clear search"
            onClick={() => {
              setRawQuery("");
              setQuery("");
              inputRef.current?.focus();
            }}
            className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={12} />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded border border-black/10 px-1 text-[10px] text-gray-400 sm:block dark:border-white/10">
            ⌘K
          </kbd>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl sm:right-auto sm:w-[380px] dark:border-white/10 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-black/5 px-3 py-1.5 dark:border-white/5">
            <span className="text-[10px] font-medium tracking-wide text-gray-400 uppercase">
              {results.length > 0
                ? `${results.length} result${results.length > 1 ? "s" : ""} · Enter opens here`
                : "No matching ideas"}
            </span>
            <label className="flex cursor-pointer items-center gap-1 text-[10px] text-gray-400">
              <input
                type="checkbox"
                checked={includeDone}
                onChange={(e) => {
                  setIncludeDone(e.target.checked);
                  setActiveIndex(0);
                  setExpandedId(null);
                }}
                className="h-3 w-3 accent-violet-600"
              />
              Done
            </label>
          </div>
          {results.map((idea, idx) => {
            const isDone = DONE_STATUSES.includes(idea.status);
            const isActive = idx === activeIndex;
            const isExpanded = expandedId === idea.id;
            const smartView = getSmartRevealView(idea, ideas);
            const revealOptions = currentView ? getRevealOptions(currentView, idea, ideas) : [];
            return (
              <div key={idea.id}>
                <div
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex items-start justify-between gap-2 px-3 py-2 ${isActive ? "bg-violet-50/70 dark:bg-violet-500/10" : ""} ${isDone ? "opacity-60" : ""}`}
                >
                  <button
                    onClick={() => openInCurrentView(idea.id)}
                    title={currentView ? "Open in current view" : "Open"}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="line-clamp-2 text-sm leading-snug break-words text-gray-800 dark:text-gray-200">
                      {idea.text || "empty"}
                    </p>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {idea.type && (
                        <span
                          className={`rounded-full border px-1.5 py-px text-[10px] font-medium ${TYPE_COLORS[idea.type]}`}
                        >
                          {getTypeLabel(idea.type)}
                        </span>
                      )}
                      <span
                        className={`rounded-full border px-1.5 py-px text-[10px] font-medium ${STATUS_STYLES[idea.status]}`}
                      >
                        {STATUS_LABELS[idea.status]}
                      </span>
                      {formatScheduleLabel(idea) && (
                        <span className="rounded border border-violet-200 bg-violet-50 px-1 py-px text-[10px] text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">
                          {formatScheduleLabel(idea)}
                        </span>
                      )}
                      <span className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                        {getPathLabel(idea, ideasById)}
                      </span>
                    </span>
                  </button>
                  <span className="flex shrink-0 items-center gap-1 pt-0.5">
                    {currentView && (
                      <span
                        title={`Reveal in ${getRevealLabel(smartView)}`}
                        className="hidden rounded border border-black/5 px-1 py-px text-[10px] text-gray-400 lg:block dark:border-white/10"
                      >
                        ⏎ {getRevealLabel(smartView).slice(0, 8)}
                      </span>
                    )}
                    <button
                      aria-label={`Reveal options for ${idea.text || "idea"}`}
                      title="Reveal in other views"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveIndex(idx);
                        setExpandedId(isExpanded ? null : idea.id);
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
                    >
                      <Eye size={13} />
                    </button>
                  </span>
                </div>
                {isExpanded && (
                  <div className="border-t border-black/5 bg-black/[0.015] px-3 py-1.5 dark:border-white/5 dark:bg-white/[0.02]">
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
                      <CornerDownLeft size={10} />
                      Open in
                    </p>
                    {currentView == null && (
                      <p className="px-1 pb-1 text-[11px] text-gray-400 italic">
                        Current view doesn&apos;t support highlight — pick a view:
                      </p>
                    )}
                    {revealOptions.map((opt) => (
                      <button
                        key={opt.view}
                        onClick={() => {
                          router.push(opt.href);
                          setOpen(false);
                          setRawQuery("");
                          setQuery("");
                        }}
                        className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                      >
                        {VIEW_ICON[opt.view]}
                        {opt.label}
                        {opt.view === smartView && (
                          <span className="rounded bg-violet-100 px-1 text-[10px] text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                            best
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

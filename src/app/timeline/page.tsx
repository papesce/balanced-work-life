"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useIdeas } from "@/hooks/useIdeas";
import { AppShell } from "@/components/AppShell";
import { AreaPicker } from "@/components/brainstorm/AreaPicker";
import { Idea, LifeArea } from "@/lib/types";
import { 
  getToday, 
  getDatesRange, 
  formatDate, 
  isPast 
} from "@/lib/dateUtils";

const AREA_COLORS: Record<LifeArea, string> = {
  work: "bg-indigo-50 text-indigo-600 border-indigo-200",
  health: "bg-red-50 text-red-600 border-red-200",
  relationships: "bg-pink-50 text-pink-600 border-pink-200",
  growth: "bg-amber-50 text-amber-600 border-amber-200",
  finances: "bg-emerald-50 text-emerald-600 border-emerald-200",
  life: "bg-purple-50 text-purple-600 border-purple-200",
};

export default function TimelinePage() {
  const { ideas, loading, createIdea, updateIdea, markDone, markUndone } = useIdeas();
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const todayRef = useRef<HTMLElement>(null);
  const hasAutoScrolled = useRef(false);

  const dates = useMemo(() => getDatesRange(3, 14), []);
  const today = getToday();

  const tasks = useMemo(() => ideas.filter((i) => i.type === "task"), [ideas]);

  const inboxTasks = useMemo(
    () => tasks.filter((t) => !t.scheduled_date && t.status !== "completed"),
    [tasks]
  );

  const tasksByDate = useMemo(() => {
    const map: Record<string, Idea[]> = {};
    for (const task of tasks) {
      if (task.scheduled_date) {
        if (!map[task.scheduled_date]) map[task.scheduled_date] = [];
        map[task.scheduled_date].push(task);
      }
    }
    return map;
  }, [tasks]);

  const handleAdd = async (text: string, area: LifeArea, scheduledDate: string | null) => {
    await createIdea(text, null, "top", { 
      type: "task", 
      area, 
      scheduled_date: scheduledDate,
      status: scheduledDate ? "scheduled" : "inbox"
    });
  };

  const handleQuickAdd = async (e: React.KeyboardEvent<HTMLInputElement>, date: string | null) => {
    if (e.key === "Enter" && e.currentTarget.value.trim()) {
      const text = e.currentTarget.value;
      e.currentTarget.value = "";
      await handleAdd(text, "life", date);
    }
  };

  const togglePriority = async (task: Idea) => {
    await updateIdea(task.id, { is_priority: !task.is_priority });
  };

  const scrollToToday = () => {
    todayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    if (!loading && !hasAutoScrolled.current) {
      // Small delay to ensure the DOM is ready for scrolling
      const timer = setTimeout(() => {
        scrollToToday();
        hasAutoScrolled.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading timeline...</div>
      </div>
    );
  }

  const headerActions = (
    <button
      onClick={scrollToToday}
      className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 shadow-sm transition-colors"
    >
      Jump to Today
    </button>
  );

  return (
    <AppShell title="Timeline" onAdd={handleAdd} headerActions={headerActions}>
      <div className="space-y-8 pb-20">
        {/* Inbox Section */}
        <section className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Inbox</h2>
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold">
              {inboxTasks.length}
            </span>
          </div>
          <div className="space-y-2">
            {inboxTasks.map((task) => (
              <TaskRow 
                key={task.id} 
                task={task} 
                onDone={markDone} 
                onUndone={markUndone}
                onUpdate={updateIdea}
                onTogglePriority={() => togglePriority(task)} 
              />
            ))}
            <input
              type="text"
              placeholder="+ Add to inbox..."
              className="w-full bg-transparent border-none text-sm py-1 focus:ring-0 placeholder:text-gray-400"
              onKeyDown={(e) => handleQuickAdd(e, null)}
            />
          </div>
        </section>

        {/* Scrollable Days */}
        <div className="space-y-6">
          {dates.map((date) => {
            const dayTasks = tasksByDate[date] || [];
            const isTodayDate = date === today;
            const unresolvedCount = dayTasks.filter((t) => !t.done_at && isPast(date)).length;
            const isFocused = focusDay === date;
            const priorities = dayTasks.filter(t => t.is_priority);

            return (
              <section 
                key={date} 
                ref={isTodayDate ? todayRef : null}
                className={`relative ${isTodayDate ? "scale-[1.02] z-10" : ""}`}
              >
                <div 
                  className={`rounded-xl border transition-all ${
                    isTodayDate 
                      ? "bg-white border-indigo-200 shadow-md ring-1 ring-indigo-50" 
                      : "bg-white border-gray-100 shadow-sm"
                  } ${isFocused ? "ring-2 ring-indigo-500" : ""}`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold uppercase tracking-tighter ${isTodayDate ? "text-indigo-600" : "text-gray-400"}`}>
                          {isTodayDate ? "Today" : formatDate(date).split(",")[0]}
                        </span>
                        <span className="text-lg font-black text-gray-900 leading-tight">
                          {formatDate(date).split(",")[1]}
                        </span>
                      </div>
                      {unresolvedCount > 0 && (
                        <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                          {unresolvedCount} UNRESOLVED
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => setFocusDay(isFocused ? null : date)}
                      className={`text-xs px-3 py-1 rounded-full font-bold transition-colors ${
                        isFocused 
                          ? "bg-indigo-600 text-white" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {isFocused ? "Close Focus" : "Focus"}
                    </button>
                  </div>

                  {/* Day Content */}
                  <div className="p-4 space-y-3">
                    {/* Top Priorities in Normal Mode (Teaser) */}
                    {!isFocused && priorities.length > 0 && (
                      <div className="flex gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
                        {priorities.map(p => (
                          <div key={p.id} className="flex-shrink-0 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            ★ {p.text}
                          </div>
                        ))}
                      </div>
                    )}

                    {dayTasks.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2">No tasks planned</p>
                    ) : (
                      <div className="space-y-2">
                        {dayTasks.map((task) => (
                          <TaskRow 
                            key={task.id} 
                            task={task} 
                            onDone={markDone} 
                            onUndone={markUndone}
                            onUpdate={updateIdea}
                            onTogglePriority={() => togglePriority(task)}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Focus Mode Expansion */}
                    {isFocused && (
                      <div className="mt-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 space-y-6">
                        <div>
                          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Top Priorities</h3>
                          <div className="space-y-2">
                            {priorities.length === 0 ? (
                              <p className="text-[10px] text-gray-400 italic">No priorities set. Tap ★ on a task to prioritize.</p>
                            ) : (
                              priorities.map(p => (
                                <div key={p.id} className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg p-2">
                                  <span className="text-amber-500">★</span>
                                  <span className="text-xs font-bold text-amber-900">{p.text}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Today's Schedule</h3>
                          <div className="space-y-1">
                            {["09:00", "12:00", "15:00", "18:00"].map(time => (
                              <div key={time} className="flex items-center gap-3 py-2 border-b border-gray-50">
                                <span className="text-[10px] font-bold text-gray-400 w-10">{time}</span>
                                <div className="flex-1 h-6 bg-gray-50 rounded border border-dashed border-gray-200"></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Inline Add */}
                    <input
                      type="text"
                      placeholder={`+ Add task for ${isTodayDate ? "today" : formatDate(date).split(",")[1]}...`}
                      className="w-full bg-transparent border-none text-sm py-1 focus:ring-0 placeholder:text-gray-300 italic"
                      onKeyDown={(e) => handleQuickAdd(e, date)}
                    />
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function TaskRow({ 
  task, 
  onDone, 
  onUndone,
  onUpdate,
  onTogglePriority
}: { 
  task: Idea; 
  onDone: (id: string) => void; 
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onTogglePriority: () => void;
}) {
  const isCompleted = !!task.done_at;
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  
  return (
    <div className={`flex items-center gap-3 transition-opacity ${isCompleted ? "opacity-40" : ""}`}>
      <button
        onClick={() => isCompleted ? onUndone(task.id) : onDone(task.id)}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          isCompleted 
            ? "bg-green-500 border-green-500" 
            : "border-gray-300 hover:border-indigo-500"
        }`}
      >
        {isCompleted && <span className="text-white text-[10px]">✓</span>}
      </button>
      <span className={`text-sm text-gray-800 flex-1 truncate ${isCompleted ? "line-through text-gray-500" : ""}`}>
        {task.text}
      </span>
      <button 
        onClick={onTogglePriority}
        className={`text-xs transition-colors ${task.is_priority ? "text-amber-500" : "text-gray-200 hover:text-gray-400"}`}
      >
        ★
      </button>

      <div className="relative">
        <button
          onClick={() => setShowAreaPicker(!showAreaPicker)}
          className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase border transition-colors ${
            task.area ? AREA_COLORS[task.area] : "border-gray-200 text-gray-400 hover:border-gray-300"
          }`}
        >
          {task.area || "Area"}
        </button>
        {showAreaPicker && (
          <AreaPicker
            current={task.area}
            onSelect={(area) => {
              onUpdate(task.id, { area });
              setShowAreaPicker(false);
            }}
            onClose={() => setShowAreaPicker(false)}
          />
        )}
      </div>
    </div>
  );
}

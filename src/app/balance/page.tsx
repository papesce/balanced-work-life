"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { BalanceWindowToggle } from "@/components/balance/BalanceWindowToggle";
import { DayCalendarView } from "@/components/balance/DayCalendarView";
import { WeekRingView } from "@/components/balance/WeekRingView";
import { MonthRingView } from "@/components/balance/MonthRingView";
import { YearWheelView } from "@/components/balance/YearWheelView";
import { WindowType, getToday } from "@/lib/dateUtils";

export default function BalancePage() {
  return (
    <AppShell title="Life Compass">
      <Suspense>
        <BalancePageInner />
      </Suspense>
    </AppShell>
  );
}

function BalancePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const windowParam = (searchParams.get("window") ?? "day") as WindowType;
  const dateParam = searchParams.get("date") ?? getToday();

  const handleChange = (newWindow: WindowType, newDate: string) => {
    const params = new URLSearchParams();
    params.set("window", newWindow);
    params.set("date", newDate);
    router.replace(`/balance?${params.toString()}`);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="glass-card px-5 py-4 rounded-[20px]">
        <BalanceWindowToggle
          window={windowParam}
          referenceDate={dateParam}
          onChange={handleChange}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${windowParam}-${dateParam}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {windowParam === "day" && <DayCalendarView referenceDate={dateParam} />}
          {windowParam === "week" && <WeekRingView referenceDate={dateParam} />}
          {windowParam === "month" && <MonthRingView referenceDate={dateParam} />}
          {windowParam === "year" && <YearWheelView referenceDate={dateParam} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BucketData } from "@/hooks/useBalanceData";
import { AREA_ORDER, AREA_LABELS } from "@/components/planner/constants";
import { areaColors } from "@/styles/tokens";
import { LifeArea } from "@/lib/types";

interface BalanceTimelineChartProps {
  buckets: BucketData[];
}

export function BalanceTimelineChart({ buckets }: BalanceTimelineChartProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const hasData = buckets.some((b) => AREA_ORDER.some((a) => b.counts[a] > 0));

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[220px] text-sm text-gray-400 dark:text-gray-500 italic">
        No tasks in this period
      </div>
    );
  }

  const chartData = buckets.map((b) => ({
    label: b.label,
    ...Object.fromEntries(AREA_ORDER.map((a) => [a, b.counts[a]])),
  }));

  const axisColor = isDark ? "#6b7280" : "#9ca3af";

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: axisColor }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: axisColor }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: isDark ? "rgba(17,17,27,0.9)" : "rgba(255,255,255,0.95)",
            border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
            borderRadius: 10,
            fontSize: 12,
          }}
          cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
          formatter={(value: string) => AREA_LABELS[value as LifeArea] ?? value}
        />
        {AREA_ORDER.map((area) => (
          <Bar
            key={area}
            dataKey={area}
            stackId="a"
            fill={areaColors[area]?.dot ?? "#cbd5e1"}
            name={area}
            radius={area === AREA_ORDER[AREA_ORDER.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

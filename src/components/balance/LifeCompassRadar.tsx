"use client";

import { useEffect, useState } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { RadarDataPoint } from "@/hooks/useBalanceData";
import { AREA_LABELS } from "@/components/planner/constants";
import { areaColors, areaDarkColors } from "@/styles/tokens";
import { LifeArea } from "@/lib/types";

interface LifeCompassRadarProps {
  data: RadarDataPoint[];
}

export function LifeCompassRadar({ data }: LifeCompassRadarProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const chartData = data.map((d) => ({
    area: AREA_LABELS[d.area as LifeArea] ?? d.area,
    Actual: d.actual,
    Target: d.target,
  }));

  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const actualColor = "#8b5cf6";
  const targetColor = isDark ? "#4b5563" : "#d1d5db";

  if (data.length === 0 || data.every((d) => d.actual === 0)) {
    return (
      <div className="flex items-center justify-center h-full min-h-[220px] text-sm text-gray-400 dark:text-gray-500 italic">
        No tasks in this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <PolarGrid stroke={gridColor} />
        <PolarAngleAxis
          dataKey="area"
          tick={{ fontSize: 11, fill: tickColor, fontWeight: 600 }}
        />
        <Radar
          name="Target"
          dataKey="Target"
          stroke={targetColor}
          fill="none"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
        <Radar
          name="Actual"
          dataKey="Actual"
          stroke={actualColor}
          fill={actualColor}
          fillOpacity={0.18}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{
            background: isDark ? "rgba(17,17,27,0.9)" : "rgba(255,255,255,0.95)",
            border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
            borderRadius: 10,
            fontSize: 12,
          }}
          formatter={(value, name) => [`${value}%`, name]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { Task } from "@/lib/types";

const COLORS = { work: "#6366f1", life: "#10b981" };

interface BalanceChartProps {
  tasks: Task[];
}

export function BalanceChart({ tasks }: BalanceChartProps) {
  const workCount = tasks.filter((t) => t.balance_category === "work").length;
  const lifeCount = tasks.filter((t) => t.balance_category === "life").length;
  const total = workCount + lifeCount;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <p>Add tasks to see your balance</p>
      </div>
    );
  }

  const data = [
    { name: "Work", value: workCount },
    { name: "Life", value: lifeCount },
  ];

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            dataKey="value"
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
          >
            <Cell fill={COLORS.work} />
            <Cell fill={COLORS.life} />
          </Pie>
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

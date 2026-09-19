"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { CHART_COLORS, chartAxisTick, chartGridStroke, chartTooltipStyle } from "@/components/charts/chart-theme";

export default function StatusBarChart({ chartData }: { chartData: { name: string; total: number }[] }) {
  return (
    <ResponsiveContainer>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
        <XAxis dataKey="name" tick={chartAxisTick} />
        <YAxis allowDecimals={false} tick={chartAxisTick} />
        <Tooltip {...chartTooltipStyle} />
        <Bar dataKey="total" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

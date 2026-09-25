"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import { CHART_COLORS, chartAxisTick, chartGridStroke, chartTooltipStyle } from "@/components/charts/chart-theme";

export default function StatusBarChart({ chartData }: { chartData: { name: string; total: number }[] }) {
  const summary =
    chartData.length > 0
      ? `Tarefas por status: ${chartData.map((d) => `${d.name}, ${d.total}`).join("; ")}`
      : "Tarefas por status: nenhuma tarefa";

  return (
    <div role="img" aria-label={summary} className="w-full h-full">
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
          <XAxis dataKey="name" tick={chartAxisTick} />
          <YAxis allowDecimals={false} tick={chartAxisTick} />
          <Tooltip {...chartTooltipStyle} />
          <Bar dataKey="total" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]}>
            <LabelList dataKey="total" position="top" style={{ fontSize: 12, fontWeight: 600, fill: "var(--color-text)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const CHART_COLORS = {
  primary: "var(--color-primary)",
  primaryDark: "var(--color-primary-dark)",
  accent: "var(--color-accent)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
};

export const chartAxisTick = { fontSize: 11, fill: "var(--color-text-secondary)" };

export const chartGridStroke = "var(--color-border)";

export const chartTooltipStyle = {
  contentStyle: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 12,
    fontSize: 12,
    color: "var(--color-text)",
  },
  labelStyle: { color: "var(--color-text)", fontWeight: 600 },
  itemStyle: { color: "var(--color-text-secondary)" },
  cursor: { fill: "var(--color-border)", fillOpacity: 0.35 },
};

export const chartLegendStyle = { fontSize: 12, color: "var(--color-text-secondary)" };

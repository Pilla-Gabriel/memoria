const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  EM_ANDAMENTO: { label: "Em andamento", bg: "rgba(6,169,244,0.12)", fg: "var(--color-primary-dark)" },
  ATINGIDA: { label: "Atingida", bg: "rgba(34,197,94,0.12)", fg: "#166534" },
  EM_RISCO: { label: "Em risco", bg: "rgba(245,158,11,0.12)", fg: "#92400e" },
  VENCIDA: { label: "Vencida", bg: "rgba(239,68,68,0.12)", fg: "#991b1b" },
  CANCELADA: { label: "Cancelada", bg: "rgba(107,114,128,0.12)", fg: "#6b7280" },
};

const TYPE_LABEL: Record<string, string> = {
  DIARIA: "Diária",
  SEMANAL: "Semanal",
  MENSAL: "Mensal",
  TRIMESTRAL: "Trimestral",
  ANUAL: "Anual",
};

export function GoalStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.EM_ANDAMENTO;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

export function GoalTypeLabel({ type }: { type: string }) {
  return <>{TYPE_LABEL[type] ?? type}</>;
}

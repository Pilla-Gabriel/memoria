const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  PENDENTE: { label: "Pendente", bg: "rgba(107,114,128,0.12)", fg: "#374151" },
  EM_ANDAMENTO: { label: "Em andamento", bg: "rgba(6,169,244,0.12)", fg: "var(--color-primary-dark)" },
  AGUARDANDO_TERCEIROS: { label: "Aguardando terceiros", bg: "rgba(245,158,11,0.12)", fg: "#92400e" },
  CONCLUIDA: { label: "Concluída", bg: "rgba(34,197,94,0.12)", fg: "#166534" },
  CANCELADA: { label: "Cancelada", bg: "rgba(107,114,128,0.12)", fg: "#6b7280" },
  ATRASADA: { label: "Atrasada", bg: "rgba(239,68,68,0.12)", fg: "#991b1b" },
};

const PRIORITY_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  BAIXA: { label: "Baixa", bg: "rgba(107,114,128,0.12)", fg: "#374151" },
  MEDIA: { label: "Média", bg: "rgba(6,169,244,0.12)", fg: "var(--color-primary-dark)" },
  ALTA: { label: "Alta", bg: "rgba(245,158,11,0.12)", fg: "#92400e" },
  URGENTE: { label: "Urgente", bg: "rgba(239,68,68,0.12)", fg: "#991b1b" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.PENDENTE;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.MEDIA;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

export function NeedsDueDateBadge() {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: "rgba(239,68,68,0.12)", color: "#991b1b" }}
    >
      Sem prazo definido
    </span>
  );
}

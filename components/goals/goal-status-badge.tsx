import { Badge, type BadgeTone } from "@/components/ui/badge";

const STATUS_STYLE: Record<string, { label: string; tone: BadgeTone }> = {
  EM_ANDAMENTO: { label: "Em andamento", tone: "primary" },
  ATINGIDA: { label: "Atingida", tone: "success" },
  EM_RISCO: { label: "Em risco", tone: "warning" },
  VENCIDA: { label: "Vencida", tone: "danger" },
  CANCELADA: { label: "Cancelada", tone: "muted" },
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
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function GoalTypeLabel({ type }: { type: string }) {
  return <>{TYPE_LABEL[type] ?? type}</>;
}

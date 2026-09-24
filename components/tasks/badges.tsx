import { Badge, type BadgeTone } from "@/components/ui/badge";

const STATUS_STYLE: Record<string, { label: string; tone: BadgeTone }> = {
  PENDENTE: { label: "Pendente", tone: "neutral" },
  EM_ANDAMENTO: { label: "Em andamento", tone: "primary" },
  AGUARDANDO_TERCEIROS: { label: "Aguardando terceiros", tone: "warning" },
  CONCLUIDA: { label: "Concluída", tone: "success" },
  CANCELADA: { label: "Cancelada", tone: "muted" },
  ATRASADA: { label: "Atrasada", tone: "danger" },
};

const PRIORITY_STYLE: Record<string, { label: string; tone: BadgeTone }> = {
  BAIXA: { label: "Baixa", tone: "neutral" },
  MEDIA: { label: "Média", tone: "primary" },
  ALTA: { label: "Alta", tone: "warning" },
  URGENTE: { label: "Urgente", tone: "danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.PENDENTE;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.MEDIA;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function NeedsDueDateBadge() {
  return <Badge tone="danger">Sem prazo definido</Badge>;
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Clock,
  AlertTriangle,
  AlertOctagon,
  CalendarX,
  CalendarClock,
  Target,
  MessageCircleQuestion,
  TrendingDown,
  RefreshCcw,
  Lock,
} from "lucide-react";

type Alert = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedType: string | null;
  relatedId: string | null;
};

const TYPE_META: Record<string, { icon: typeof Bell; tone: string }> = {
  PRAZO_7D: { icon: Clock, tone: "default" },
  PRAZO_3D: { icon: Clock, tone: "warning" },
  PRAZO_1D: { icon: AlertTriangle, tone: "warning" },
  VENCE_HOJE: { icon: AlertTriangle, tone: "warning" },
  ATRASADA: { icon: AlertOctagon, tone: "danger" },
  SEM_PRAZO: { icon: CalendarX, tone: "warning" },
  PRORROGACAO_PENDENTE: { icon: CalendarClock, tone: "warning" },
  META_RISCO: { icon: Target, tone: "warning" },
  META_VENCIDA: { icon: Target, tone: "danger" },
  CHECKIN_PENDENTE: { icon: MessageCircleQuestion, tone: "primary" },
  FRENTE_EM_RISCO: { icon: TrendingDown, tone: "danger" },
  FRENTE_SEM_ATUALIZACAO: { icon: RefreshCcw, tone: "warning" },
  BLOQUEIO_ABERTO: { icon: Lock, tone: "danger" },
};

const TONE_COLOR: Record<string, string> = {
  default: "var(--color-text-secondary)",
  primary: "var(--color-primary)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
};

const GROUPS: { label: string; types: string[] }[] = [
  { label: "Prazos e tarefas", types: ["ATRASADA", "VENCE_HOJE", "PRAZO_1D", "PRAZO_3D", "PRAZO_7D", "SEM_PRAZO", "PRORROGACAO_PENDENTE"] },
  { label: "Metas", types: ["META_RISCO", "META_VENCIDA"] },
  { label: "Check-in", types: ["CHECKIN_PENDENTE"] },
  { label: "Entrega Semanal", types: ["FRENTE_EM_RISCO", "FRENTE_SEM_ATUALIZACAO", "BLOQUEIO_ABERTO"] },
];

const LINK_BY_TYPE: (a: Alert) => string | null = (a) => {
  if (a.relatedType === "Task" && a.relatedId) return `/tarefas/${a.relatedId}`;
  if (a.relatedType === "Goal" && a.relatedId) return `/metas/${a.relatedId}`;
  if (a.relatedType === "CheckInSession" && a.relatedId) return `/checkin/${a.relatedId}`;
  if (a.relatedType === "Frente" && a.relatedId) return `/entrega-semanal/frentes/${a.relatedId}`;
  if (a.relatedType === "WeeklyReport" && a.relatedId) return `/entrega-semanal/relatorios/${a.relatedId}`;
  return null;
};

export default function AlertasPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/alerts");
    const data = await res.json();
    setAlerts(data.alerts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setRead(id: string, read: boolean) {
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    });
    load();
    router.refresh();
  }

  async function snooze(id: string) {
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snooze: true }),
    });
    load();
    router.refresh();
  }

  async function markAllRead() {
    await fetch("/api/alerts/read-all", { method: "POST" });
    load();
    router.refresh();
  }

  function renderAlert(alert: Alert) {
    const meta = TYPE_META[alert.type] ?? { icon: Bell, tone: "default" };
    const IconComponent = meta.icon;
    const href = LINK_BY_TYPE(alert);
    const content = (
      <div
        className="flex items-start gap-3 p-4 border-l-[3px]"
        style={{ borderLeftColor: TONE_COLOR[meta.tone], opacity: alert.read ? 0.55 : 1 }}
      >
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(0,0,0,0.04)", color: TONE_COLOR[meta.tone] }}
        >
          <IconComponent size={17} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm">{alert.message}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              {new Date(alert.createdAt).toLocaleString("pt-BR")}
            </p>
            {!href && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}
              >
                Sem ação
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.preventDefault();
              setRead(alert.id, !alert.read);
            }}
            className="text-xs font-semibold"
            style={{ color: alert.read ? "var(--color-text-secondary)" : "var(--color-primary)" }}
          >
            {alert.read ? "Marcar não lido" : "Marcar lido"}
          </button>
          {!alert.read && (
            <button
              onClick={(e) => {
                e.preventDefault();
                snooze(alert.id);
              }}
              className="text-xs"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Adiar 1 dia
            </button>
          )}
        </div>
      </div>
    );

    return href ? (
      <a key={alert.id} href={href} className="block hover:bg-black/[0.02]">
        {content}
      </a>
    ) : (
      <div key={alert.id} style={{ cursor: "default" }}>
        {content}
      </div>
    );
  }

  const grouped = GROUPS.map((g) => ({ ...g, alerts: alerts.filter((a) => g.types.includes(a.type)) })).filter(
    (g) => g.alerts.length > 0
  );
  const knownTypes = GROUPS.flatMap((g) => g.types);
  const ungrouped = alerts.filter((a) => !knownTypes.includes(a.type));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alertas</h1>
        <button onClick={markAllRead} className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          Marcar todos como lidos
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>
      ) : alerts.length === 0 ? (
        <div className="card p-6 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Nenhum alerta por aqui.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <div key={g.label}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  {g.label}
                </h2>
                <span
                  className="text-xs font-semibold rounded-full px-2 py-0.5"
                  style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}
                >
                  {g.alerts.length}
                </span>
              </div>
              <div className="card divide-y" style={{ borderColor: "var(--color-border)" }}>
                {g.alerts.map(renderAlert)}
              </div>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div className="card divide-y" style={{ borderColor: "var(--color-border)" }}>
              {ungrouped.map(renderAlert)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

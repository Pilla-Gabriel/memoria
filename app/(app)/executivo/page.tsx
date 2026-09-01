"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { AzureBreakdownTable } from "@/components/entrega-semanal/azure-breakdown-table";
import { CHART_COLORS, chartAxisTick, chartGridStroke, chartTooltipStyle } from "@/components/charts/chart-theme";
import {
  TrendingUp,
  AlertOctagon,
  Clock,
  CalendarClock,
  Award,
  XCircle,
  MessageCircleQuestion,
  Send,
} from "lucide-react";

type Summary = {
  statusCounts: { status: string; count: number }[];
  taxaConclusao: number;
  taxaAtraso: number;
  avgCompletionDays: number;
  extensionsCount: number;
  checkinRecovered: number;
  goalsAtingidas: number;
  goalsVencidas: number;
  topProductive: { id: string; name: string; completedCount: number }[];
  topDelayed: { id: string; name: string; countDelays: number; classification: string }[];
  entregaSemanal: {
    totalFrentes: number;
    frentesEmRisco: number;
    openBlockers: number;
    azureEnv: boolean;
    azureConfigured: boolean;
    azureFrenteCount: number;
    lastAzureSyncAt: string | null;
  };
};

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_TERCEIROS: "Aguardando terceiros",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
  ATRASADA: "Atrasada",
};

const SUMMARY_POLL_MS = 60_000;

export default function ExecutivoPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let hasLoadedOnce = false;
    const load = () => {
      fetch("/api/executive/summary")
        .then(async (r) => {
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error ?? "Erro ao carregar");
          }
          return r.json();
        })
        .then((json) => {
          if (cancelled) return;
          hasLoadedOnce = true;
          setData(json);
        })
        .catch((e) => {
          // Uma falha numa atualização em segundo plano não deve substituir
          // um painel que já carregou com sucesso — só a primeira falha vira tela de erro.
          if (!cancelled && !hasLoadedOnce) setError(e.message);
        });
    };
    load();
    const id = setInterval(load, SUMMARY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error) return <p style={{ color: "var(--color-danger)" }}>{error}</p>;
  if (!data) return <ExecutivoSkeleton />;

  const chartData = data.statusCounts.map((s) => ({ name: STATUS_LABEL[s.status] ?? s.status, total: s.count }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Dashbord</h1>
        <p style={{ color: "var(--color-text-secondary)" }}>Indicadores consolidados de produtividade e accountability.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Taxa de conclusão" value={`${data.taxaConclusao}%`} icon={TrendingUp} tone="success" href="/tarefas?status=CONCLUIDA&scope=team" />
        <StatCard label="Taxa de atraso" value={`${data.taxaAtraso}%`} icon={AlertOctagon} tone="danger" href="/tarefas?status=ATRASADA&scope=team" />
        <StatCard label="Tempo médio de conclusão" value={`${data.avgCompletionDays}d`} icon={Clock} tone="primary" href="/tarefas?status=CONCLUIDA&scope=team" />
        <StatCard label="Prorrogações realizadas" value={data.extensionsCount} icon={CalendarClock} tone="warning" href="/tarefas?scope=team" />
        <StatCard label="Metas atingidas" value={data.goalsAtingidas} icon={Award} tone="success" href="/metas?status=ATINGIDA" />
        <StatCard label="Metas vencidas" value={data.goalsVencidas} icon={XCircle} tone="danger" href="/metas?status=VENCIDA" />
        <StatCard label="Recuperados via check-in" value={data.checkinRecovered} icon={MessageCircleQuestion} tone="primary" href="/checkin" />
      </div>

      {/* O card completo (Frentes/Em risco/Bloqueios) já vive no Painel — aqui fica
          só um resumo de uma linha, para não duplicar a mesma visualização em duas telas. */}
      <Link
        href="/entrega-semanal"
        className="card px-5 py-3.5 flex items-center justify-between gap-3 hover:shadow-lg transition-shadow"
      >
        <span className="font-semibold flex items-center gap-2 text-sm">
          <Send size={16} /> Entrega Semanal
          <span style={{ color: "var(--color-text-secondary)", fontWeight: 400 }}>
            · {data.entregaSemanal.totalFrentes} frente(s)
            {data.entregaSemanal.frentesEmRisco > 0 && (
              <span style={{ color: "var(--color-danger)" }}> · {data.entregaSemanal.frentesEmRisco} em risco</span>
            )}
            {data.entregaSemanal.openBlockers > 0 && (
              <span style={{ color: "var(--color-warning)" }}> · {data.entregaSemanal.openBlockers} bloqueio(s)</span>
            )}
          </span>
        </span>
        <span className="text-xs font-semibold shrink-0" style={{ color: "var(--color-primary)" }}>
          Ver tudo →
        </span>
      </Link>

      <AzureBreakdownTable syncSummary={data.entregaSemanal} />

      <div className="card p-5">
        <h2 className="font-semibold mb-4">Tarefas por status</h2>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
              <XAxis dataKey="name" tick={chartAxisTick} />
              <YAxis allowDecimals={false} tick={chartAxisTick} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="total" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Responsáveis mais produtivos</h2>
          <ul className="space-y-2 text-sm">
            {data.topProductive.map((u, i) => (
              <li key={u.id} className="flex items-center justify-between">
                <span>
                  {i + 1}. {u.name}
                </span>
                <span className="font-semibold" style={{ color: "var(--color-success)" }}>
                  {u.completedCount} concluídas
                </span>
              </li>
            ))}
            {data.topProductive.length === 0 && (
              <p style={{ color: "var(--color-text-secondary)" }}>Sem dados suficientes.</p>
            )}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-4">Responsáveis com maior atraso</h2>
          <ul className="space-y-2 text-sm">
            {data.topDelayed.map((u, i) => (
              <li key={u.id} className="flex items-center justify-between">
                <span>
                  {i + 1}. {u.name}
                </span>
                <span className="font-semibold" style={{ color: "var(--color-danger)" }}>
                  {u.countDelays} atrasos · {u.classification}
                </span>
              </li>
            ))}
            {data.topDelayed.length === 0 && (
              <p style={{ color: "var(--color-text-secondary)" }}>Nenhum atraso registrado. Ótimo sinal!</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ExecutivoSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px]" />
        ))}
      </div>
      <Skeleton className="h-[110px]" />
      <Skeleton className="h-[220px]" />
      <Skeleton className="h-[280px]" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-[160px]" />
        <Skeleton className="h-[160px]" />
      </div>
    </div>
  );
}

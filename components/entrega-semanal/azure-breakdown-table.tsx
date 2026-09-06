"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layers, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { AzureSyncButton } from "@/components/entrega-semanal/azure-sync-button";
import { CHART_COLORS, chartAxisTick, chartGridStroke, chartTooltipStyle, chartLegendStyle } from "@/components/charts/chart-theme";
import { buildSprintGroups, buildHoursBySprint, buildHoursByAssignee, roundHours, type WorkItemLite } from "@/lib/azure-work-items";

type SyncSummary = {
  azureEnv: boolean;
  azureConfigured: boolean;
  azureFrenteCount: number;
  lastAzureSyncAt: string | null;
};

type Breakdown = {
  project: string;
  totalItems: number;
  totalHours: number;
  totalEstimatedHours: number;
  anyHoursTracked: boolean;
  currentSprintLabel: string | null;
  items: WorkItemLite[];
};

function SyncStatus({ syncSummary }: { syncSummary: SyncSummary }) {
  if (!syncSummary.azureEnv) {
    return (
      <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
        Integração não configurada.
      </p>
    );
  }
  return (
    <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
      {syncSummary.azureConfigured
        ? `${syncSummary.azureFrenteCount} frente(s) sincronizada(s)`
        : "Nenhuma frente configurada para sincronização automática"}
      {syncSummary.lastAzureSyncAt && ` · Última sincronização: ${new Date(syncSummary.lastAzureSyncAt).toLocaleString("pt-BR")}`}
    </p>
  );
}

// Esta é a versão resumida (KPIs + tendência) pensada pro Dashboard
// executivo — o detalhamento operacional por sprint/usuário/item vive em
// AzureSprintBreakdown, na aba "Azure DevOps" de Entrega Semanal.
const BREAKDOWN_POLL_MS = 90_000;

export function AzureBreakdownTable({ syncSummary }: { syncSummary?: SyncSummary }) {
  const [data, setData] = useState<Breakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let hasLoadedOnce = false;
    const load = () => {
      fetch("/api/azure-devops/breakdown")
        .then(async (r) => {
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error ?? "Erro ao consultar Azure DevOps");
          }
          return r.json();
        })
        .then((json) => {
          if (cancelled) return;
          hasLoadedOnce = true;
          setData(json);
        })
        .catch((e) => {
          if (!cancelled && !hasLoadedOnce) setError(e.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const id = setInterval(load, BREAKDOWN_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const items = useMemo(() => data?.items ?? [], [data]);
  const sprints = useMemo(() => buildSprintGroups(items), [items]);
  const hoursBySprint = useMemo(() => buildHoursBySprint(sprints), [sprints]);
  const hoursByAssignee = useMemo(() => buildHoursByAssignee(items), [items]);

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
      <div>
        <h2 className="font-semibold flex items-center gap-2 mb-1">
          <Layers size={17} /> Azure DevOps
        </h2>
        {syncSummary && <SyncStatus syncSummary={syncSummary} />}
      </div>
      <div className="flex items-center gap-3">
        {data && (
          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Projeto {data.project}
          </span>
        )}
        {syncSummary?.azureEnv && syncSummary.azureConfigured && <AzureSyncButton compact />}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="card p-5">
        {header}
        <p className="text-sm mt-3" style={{ color: "var(--color-text-secondary)" }}>
          Consultando Azure DevOps...
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="card p-5">
        {header}
        <p className="text-sm mt-3" style={{ color: "var(--color-text-secondary)" }}>
          {error}
        </p>
      </div>
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <div className="card p-5">
        {header}
        <p className="text-sm mt-3" style={{ color: "var(--color-text-secondary)" }}>
          Nenhum work item encontrado no projeto {data?.project}.
        </p>
      </div>
    );
  }

  const assigneeChartData = hoursByAssignee.slice(0, 10).map((a) => ({
    name: a.assignee.length > 22 ? `${a.assignee.slice(0, 22)}…` : a.assignee,
    estimada: a.estimatedHours,
    realizada: a.hours,
  }));
  const sprintChartData = hoursBySprint.map((s) => ({
    name: s.sprint,
    estimada: s.estimatedHours,
    realizada: s.hours,
  }));

  return (
    <div className="card p-5">
      {header}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {[
          { label: "Sprint atual", value: data.currentSprintLabel ?? "—" },
          { label: "Itens (total)", value: data.totalItems },
          { label: "Horas estimadas", value: data.totalEstimatedHours ? `${roundHours(data.totalEstimatedHours)}h` : "—" },
          { label: "Horas realizadas", value: data.totalHours ? `${roundHours(data.totalHours)}h` : "—" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl p-3" style={{ background: "var(--color-bg)" }}>
            <p className="text-lg font-bold">{kpi.value}</p>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              {kpi.label}
            </p>
          </div>
        ))}
      </div>
      {!data.anyHoursTracked && (
        <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Este processo não registra Horas realizadas por item.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold mb-3">Horas por Sprint (Estimada x Realizada)</h3>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={sprintChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="name" tick={chartAxisTick} />
                <YAxis allowDecimals={false} tick={chartAxisTick} />
                <Tooltip {...chartTooltipStyle} />
                <Legend wrapperStyle={chartLegendStyle} />
                <Bar dataKey="estimada" name="Estimada" fill={CHART_COLORS.warning} radius={[6, 6, 0, 0]} />
                <Bar dataKey="realizada" name="Realizada" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Horas por responsável (Estimada x Realizada)</h3>
          {assigneeChartData.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Nenhum work item com responsável atribuído foi encontrado.
            </p>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={assigneeChartData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis type="number" allowDecimals={false} tick={chartAxisTick} />
                  <YAxis type="category" dataKey="name" tick={{ ...chartAxisTick, fontSize: 10 }} width={140} />
                  <Tooltip {...chartTooltipStyle} />
                  <Legend wrapperStyle={chartLegendStyle} />
                  <Bar dataKey="estimada" name="Estimada" fill={CHART_COLORS.warning} radius={[0, 6, 6, 0]} />
                  <Bar dataKey="realizada" name="Realizada" fill={CHART_COLORS.primary} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <Link
        href="/entrega-semanal?aba=azure-devops"
        className="text-sm font-semibold flex items-center gap-1 mt-5"
        style={{ color: "var(--color-primary)" }}
      >
        Ver detalhamento por sprint e usuário <ArrowRight size={14} />
      </Link>
    </div>
  );
}

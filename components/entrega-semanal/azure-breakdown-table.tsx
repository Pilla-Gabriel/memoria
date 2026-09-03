"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { AzureSyncButton } from "@/components/entrega-semanal/azure-sync-button";
import { CHART_COLORS, chartAxisTick, chartGridStroke, chartTooltipStyle, chartLegendStyle } from "@/components/charts/chart-theme";
import {
  buildSprintGroups,
  buildHoursBySprint,
  buildHoursByPbi,
  buildHoursByAssignee,
  type WorkItemLite,
} from "@/lib/azure-work-items";

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
  anyEstimatedHoursTracked: boolean;
  items: WorkItemLite[];
};

const ALL = "__all__";

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

const BREAKDOWN_POLL_MS = 90_000;

export function AzureBreakdownTable({ syncSummary }: { syncSummary?: SyncSummary }) {
  const [data, setData] = useState<Breakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sprintFilter, setSprintFilter] = useState(ALL);
  const [assigneeFilter, setAssigneeFilter] = useState(ALL);

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

  const allItems = data?.items ?? [];
  const sprintOptions = useMemo(
    () => Array.from(new Set(allItems.map((i) => i.sprint))).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })),
    [allItems]
  );
  const assigneeOptions = useMemo(
    () => Array.from(new Set(allItems.map((i) => i.assignee))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [allItems]
  );

  const filteredItems = useMemo(
    () =>
      allItems.filter(
        (i) => (sprintFilter === ALL || i.sprint === sprintFilter) && (assigneeFilter === ALL || i.assignee === assigneeFilter)
      ),
    [allItems, sprintFilter, assigneeFilter]
  );

  const sprints = useMemo(() => buildSprintGroups(filteredItems), [filteredItems]);
  const hoursBySprint = useMemo(() => buildHoursBySprint(sprints), [sprints]);
  const hoursByPbi = useMemo(() => buildHoursByPbi(filteredItems), [filteredItems]);
  const hoursByAssignee = useMemo(() => buildHoursByAssignee(filteredItems), [filteredItems]);
  const filteredTotalHours = sprints.reduce((acc, s) => acc + s.hours, 0);
  const filteredTotalEstimatedHours = sprints.reduce((acc, s) => acc + s.estimatedHours, 0);
  const isFiltered = sprintFilter !== ALL || assigneeFilter !== ALL;

  const filterBar = sprintOptions.length > 0 && (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <select
        value={sprintFilter}
        onChange={(e) => setSprintFilter(e.target.value)}
        className="text-xs rounded-lg border px-2.5 py-1.5"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <option value={ALL}>Todas as sprints</option>
        {sprintOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        value={assigneeFilter}
        onChange={(e) => setAssigneeFilter(e.target.value)}
        className="text-xs rounded-lg border px-2.5 py-1.5"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <option value={ALL}>Todos os responsáveis</option>
        {assigneeOptions.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      {isFiltered && (
        <button
          type="button"
          onClick={() => {
            setSprintFilter(ALL);
            setAssigneeFilter(ALL);
          }}
          className="text-xs font-semibold"
          style={{ color: "var(--color-primary)" }}
        >
          Limpar filtros
        </button>
      )}
    </div>
  );

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
    <div className="space-y-5">
      <div className="card p-5">
        {header}
        {filterBar}
        {sprints.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Nenhum work item corresponde aos filtros selecionados.
          </p>
        ) : (
        <>
        <p className="text-xs mb-4 mt-2" style={{ color: "var(--color-text-secondary)" }}>
          {filteredItems.length} work item(s) · {filteredTotalHours}h realizadas · {filteredTotalEstimatedHours}h
          estimadas{isFiltered ? " (no filtro atual)" : " no total"}
          {!data.anyHoursTracked && " — este processo não registra Horas realizadas por item"}
        </p>

        <div className="space-y-5">
          {sprints.map((sprint) => (
            <div key={sprint.sprint}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold">{sprint.sprint}</h3>
                <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {sprint.count} item(s)
                </span>
              </div>
              <div className="space-y-3 pl-3 border-l-2" style={{ borderColor: "var(--color-border)" }}>
                {sprint.types.map((type) => (
                  <div key={type.type}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--color-primary-dark)" }}>
                      {type.type} · {type.count} item(s)
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b" style={{ borderColor: "var(--color-border)" }}>
                            <th className="py-1.5 pr-4 font-medium" style={{ color: "var(--color-text-secondary)" }}>
                              State
                            </th>
                            <th className="py-1.5 font-medium text-right" style={{ color: "var(--color-text-secondary)" }}>
                              Total de itens
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {type.states.map((s) => (
                            <tr key={s.state} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                              <td className="py-1.5 pr-4">{s.state}</td>
                              <td className="py-1.5 text-right">{s.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        </>
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-1">Horas por PBI</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Soma das Horas estimadas e realizadas das Tasks vinculadas a cada PBI (via System.Parent).
        </p>
        {hoursByPbi.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Nenhuma Task vinculada a um PBI foi encontrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "var(--color-border)" }}>
                  <th className="py-1.5 pr-4 font-medium" style={{ color: "var(--color-text-secondary)" }}>
                    PBI
                  </th>
                  <th className="py-1.5 pr-4 font-medium text-right" style={{ color: "var(--color-text-secondary)" }}>
                    Tasks
                  </th>
                  <th className="py-1.5 pr-4 font-medium text-right" style={{ color: "var(--color-text-secondary)" }}>
                    Horas estimadas
                  </th>
                  <th className="py-1.5 font-medium text-right" style={{ color: "var(--color-text-secondary)" }}>
                    Horas realizadas
                  </th>
                </tr>
              </thead>
              <tbody>
                {hoursByPbi.map((p) => (
                  <tr key={p.pbiId} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                    <td className="py-1.5 pr-4">{p.pbiTitle}</td>
                    <td className="py-1.5 pr-4 text-right">{p.taskCount}</td>
                    <td className="py-1.5 pr-4 text-right">{p.estimatedHours ? `${p.estimatedHours}h` : "—"}</td>
                    <td className="py-1.5 text-right">{p.hours ? `${p.hours}h` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Horas por Sprint (Estimada x Realizada)</h2>
          <div style={{ width: "100%", height: 240 }}>
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

        <div className="card p-5">
          <h2 className="font-semibold mb-4">Horas por responsável (Estimada x Realizada)</h2>
          {assigneeChartData.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Nenhum work item com responsável atribuído foi encontrado.
            </p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
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
    </div>
  );
}

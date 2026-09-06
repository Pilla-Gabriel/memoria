"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ExternalLink, Layers } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { StateCategoryBadge } from "@/components/entrega-semanal/badges";
import { CHART_COLORS, chartAxisTick, chartGridStroke, chartTooltipStyle, chartLegendStyle } from "@/components/charts/chart-theme";
import { buildUserGroups, buildHoursByPbi, roundHours, type WorkItemLite } from "@/lib/azure-work-items";

type Breakdown = {
  project: string;
  totalItems: number;
  currentSprintLabel: string | null;
  anyHoursTracked: boolean;
  anyEstimatedHoursTracked: boolean;
  items: WorkItemLite[];
};

const ALL = "__todas__";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatHours(value: number) {
  return value ? `${roundHours(value)}h` : "—";
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <td className="py-2 pr-4 truncate" style={{ color: "var(--color-text-secondary)" }} title={typeof children === "string" ? children : undefined}>
      {children}
    </td>
  );
}

// table-layout: fixed é o que faz o truncate funcionar de verdade — sem
// isso, o navegador dimensiona cada coluna pelo conteúdo e um título longo
// estoura visualmente por cima das colunas seguintes (Tipo/State) em vez de
// truncar. As larguras em <colgroup> somam a 100% da tabela.
const COLUMNS = [
  { label: "Título", width: "26%" },
  { label: "Tipo", width: "10%" },
  { label: "State", width: "9%" },
  { label: "Effort", width: "6%" },
  { label: "Horas estimadas", width: "9%" },
  { label: "Horas realizadas", width: "9%" },
  { label: "Data prevista", width: "8%" },
  { label: "Tipo de demanda", width: "8%" },
  { label: "Planejamento", width: "8%" },
  { label: "Activity", width: "7%" },
];

function ItemsTable({ items }: { items: WorkItemLite[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {COLUMNS.map((c) => (
            <col key={c.label} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-left border-b" style={{ borderColor: "var(--color-border)" }}>
            {COLUMNS.map((c) => (
              <th key={c.label} className="py-2 pr-4 font-medium truncate" style={{ color: "var(--color-text-secondary)" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
              <td className="py-2 pr-4 overflow-hidden">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:underline min-w-0"
                  style={{ color: "var(--color-text)" }}
                  title={item.title || `#${item.id}`}
                >
                  <span className="truncate">{item.title || `#${item.id}`}</span>
                  <ExternalLink size={12} className="shrink-0" style={{ color: "var(--color-text-secondary)" }} />
                </a>
              </td>
              <Cell>{item.type}</Cell>
              <td className="py-2 pr-4 overflow-hidden">
                <StateCategoryBadge state={item.state} stateCategory={item.stateCategory} />
              </td>
              <Cell>{item.effort ?? "—"}</Cell>
              <Cell>{formatHours(item.estimatedHours)}</Cell>
              <Cell>{formatHours(item.hours)}</Cell>
              <Cell>{formatDate(item.targetDate)}</Cell>
              <Cell>{item.demandType ?? "—"}</Cell>
              <Cell>{item.planning ?? "—"}</Cell>
              <Cell>{item.activity ?? "—"}</Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Projetos sem sprints reais configuradas no Azure DevOps (ex.: times sem
// iterations no team settings) caem todos num único "sprint" com o nome do
// projeto — o filtro de sprint não ajuda a reduzir a lista nesse caso.
// Renderizar milhares de linhas de uma vez trava a aba (chegamos a ver isso
// com o KPL: ~12 mil itens em uma única pessoa/sprint). Corta em vez de
// deixar a página inteira travar.
const MAX_ITEMS_PER_USER = 150;
const MAX_PBI_ROWS = 50;

function UserSection({ group }: { group: ReturnType<typeof buildUserGroups>[number] }) {
  const truncated = group.items.length > MAX_ITEMS_PER_USER;
  const visibleItems = truncated ? group.items.slice(0, MAX_ITEMS_PER_USER) : group.items;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h4 className="text-sm font-bold">{group.assignee}</h4>
        <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
          {group.count} item(s) · {formatHours(group.estimatedHours)} estimadas · {formatHours(group.hours)} realizadas
          {group.effort ? ` · Effort ${group.effort}` : ""}
        </span>
      </div>
      <div className="pl-3 border-l-2" style={{ borderColor: "var(--color-border)" }}>
        <ItemsTable items={visibleItems} />
        {truncated && (
          <p className="text-xs mt-2" style={{ color: "var(--color-text-secondary)" }}>
            Mostrando {MAX_ITEMS_PER_USER} de {group.items.length} itens. Refine o filtro de sprint ou de usuário
            para ver o restante.
          </p>
        )}
      </div>
    </div>
  );
}

export function AzureSprintBreakdown() {
  const [data, setData] = useState<Breakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string>(ALL);
  const [sprintFilterTouched, setSprintFilterTouched] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState(ALL);

  // Sem setState síncrono no corpo do efeito de montagem (regra
  // react-hooks/set-state-in-effect): "syncing"/"loading" já nascem `true`
  // no useState — só o clique manual em "Sincronizar agora" (handleSync,
  // dentro de um event handler) precisa resetá-los explicitamente antes de
  // rebuscar.
  const fetchBreakdown = () => {
    fetch("/api/azure-devops/breakdown", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          if (r.status === 400) {
            setNotConfigured(true);
            return null;
          }
          throw new Error(j.error ?? "Erro ao consultar Azure DevOps");
        }
        setNotConfigured(false);
        return r.json();
      })
      .then((json: Breakdown | null) => {
        if (!json) return;
        setError(null);
        setData(json);
        setLastFetchedAt(new Date());
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoading(false);
        setSyncing(false);
      });
  };

  useEffect(() => {
    fetchBreakdown();
  }, []);

  function handleSync() {
    setSyncing(true);
    fetchBreakdown();
  }

  const allItems = useMemo(() => data?.items ?? [], [data]);
  const sprintOptions = useMemo(
    () => Array.from(new Set(allItems.map((i) => i.sprint))).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })),
    [allItems]
  );

  // Sprint efetiva: a sprint atual do Azure DevOps (via API de iterações)
  // enquanto o usuário não mexeu no filtro manualmente, calculada direto no
  // render em vez de sincronizada via efeito — evita o setState-em-efeito
  // e não sobrescreve uma escolha manual num refresh de dados.
  const effectiveSprintFilter =
    !sprintFilterTouched && data?.currentSprintLabel && sprintOptions.includes(data.currentSprintLabel)
      ? data.currentSprintLabel
      : sprintFilter;

  const sprintScopedItems = useMemo(
    () => (effectiveSprintFilter === ALL ? allItems : allItems.filter((i) => i.sprint === effectiveSprintFilter)),
    [allItems, effectiveSprintFilter]
  );

  // "Usuários ativos" = quem tem item na sprint selecionada — a lista some
  // gente de sprints antigas assim que o filtro de sprint muda, em vez de
  // manter sempre a lista global de todo mundo que já apareceu em algum item.
  const assigneeOptions = useMemo(
    () => Array.from(new Set(sprintScopedItems.map((i) => i.assignee))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [sprintScopedItems]
  );

  // Cai de volta pra "todos" durante o render se a sprint mudou e o
  // responsável selecionado não tem mais item nela — sem efeito, só uma
  // checagem O(n) barata a cada render.
  const effectiveAssigneeFilter = assigneeOptions.includes(assigneeFilter) ? assigneeFilter : ALL;

  const filteredItems = useMemo(
    () => sprintScopedItems.filter((i) => effectiveAssigneeFilter === ALL || i.assignee === effectiveAssigneeFilter),
    [sprintScopedItems, effectiveAssigneeFilter]
  );

  const userGroups = useMemo(() => buildUserGroups(filteredItems), [filteredItems]);
  const hoursByPbi = useMemo(() => buildHoursByPbi(filteredItems), [filteredItems]);

  // Top 10 por volume de item — mesmo corte usado no gráfico "Horas por
  // responsável" do Executivo: com mais que isso o eixo de categorias fica
  // ilegível (Recharts pula a maioria dos rótulos pra não sobrepor texto).
  const chartUserGroups = userGroups.slice(0, 10);
  const truncateName = (name: string) => (name.length > 20 ? `${name.slice(0, 20)}…` : name);
  const effortVsRealizadoData = chartUserGroups.map((g) => ({
    name: truncateName(g.assignee),
    effort: g.effort,
    realizada: g.hours,
  }));
  const estimadaVsRealizadaData = chartUserGroups.map((g) => ({
    name: truncateName(g.assignee),
    estimada: g.estimatedHours,
    realizada: g.hours,
  }));

  const totalHours = filteredItems.reduce((acc, i) => acc + i.hours, 0);
  const totalEstimatedHours = filteredItems.reduce((acc, i) => acc + i.estimatedHours, 0);
  const totalEffort = filteredItems.reduce((acc, i) => acc + (i.effort ?? 0), 0);

  const isFiltered = effectiveSprintFilter !== ALL || effectiveAssigneeFilter !== ALL;

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="font-semibold flex items-center gap-2 mb-1">
          <Layers size={17} /> Azure DevOps — Sprint e usuários
        </h2>
        {data && (
          <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Projeto {data.project}
            {lastFetchedAt && ` · atualizado às ${lastFetchedAt.toLocaleTimeString("pt-BR")}`}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="text-xs font-semibold rounded-lg border px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60"
        style={{ borderColor: "var(--color-border)" }}
      >
        <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Sincronizando..." : "Sincronizar agora"}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="card p-5">
        {header}
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Consultando Azure DevOps...
        </p>
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="card p-5">
        {header}
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Integração com Azure DevOps não configurada para esta base.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-5">
        {header}
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="card p-5">
        {header}
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Nenhum work item encontrado no projeto {data?.project}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="card p-5">
        {header}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select
            value={effectiveSprintFilter}
            onChange={(e) => {
              setSprintFilterTouched(true);
              setSprintFilter(e.target.value);
              // Responsável era escopado à sprint anterior — some da lista
              // sozinho (effectiveAssigneeFilter) se não existir na nova.
            }}
            className="text-xs rounded-lg border px-2.5 py-1.5"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            <option value={ALL}>Todas as sprints</option>
            {sprintOptions.map((s) => (
              <option key={s} value={s}>
                {s === data.currentSprintLabel ? `${s} (atual)` : s}
              </option>
            ))}
          </select>
          <select
            value={effectiveAssigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="text-xs rounded-lg border px-2.5 py-1.5"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            <option value={ALL}>Todos os usuários ativos</option>
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
                setSprintFilterTouched(true);
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Itens", value: filteredItems.length },
            { label: "Horas estimadas", value: formatHours(totalEstimatedHours) },
            { label: "Horas realizadas", value: formatHours(totalHours) },
            { label: "Effort total", value: totalEffort ? roundHours(totalEffort) : "—" },
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

        {chartUserGroups.length > 0 && (
          <div className="grid gap-5 lg:grid-cols-2 mb-6">
            <div>
              <h3 className="text-sm font-semibold mb-1">Effort x Horas realizadas por usuário</h3>
              <p className="text-xs mb-3" style={{ color: "var(--color-text-secondary)" }}>
                Unidades diferentes (Effort é uma estimativa em pontos, Horas é tempo registrado) — compare a
                proporção entre pessoas, não o valor absoluto de uma barra contra a outra.
              </p>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={effortVsRealizadoData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                    <XAxis type="number" allowDecimals={false} tick={chartAxisTick} />
                    <YAxis type="category" dataKey="name" tick={{ ...chartAxisTick, fontSize: 10 }} width={120} />
                    <Tooltip {...chartTooltipStyle} />
                    <Legend wrapperStyle={chartLegendStyle} />
                    <Bar dataKey="effort" name="Effort" fill={CHART_COLORS.danger} radius={[0, 6, 6, 0]} />
                    <Bar dataKey="realizada" name="Horas realizadas" fill={CHART_COLORS.primary} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1">Horas estimadas x realizadas por usuário</h3>
              <p className="text-xs mb-3" style={{ color: "var(--color-text-secondary)" }}>
                No escopo do filtro atual (sprint/usuário selecionados).
              </p>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={estimadaVsRealizadaData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                    <XAxis type="number" allowDecimals={false} tick={chartAxisTick} />
                    <YAxis type="category" dataKey="name" tick={{ ...chartAxisTick, fontSize: 10 }} width={120} />
                    <Tooltip {...chartTooltipStyle} />
                    <Legend wrapperStyle={chartLegendStyle} />
                    <Bar dataKey="estimada" name="Estimada" fill={CHART_COLORS.warning} radius={[0, 6, 6, 0]} />
                    <Bar dataKey="realizada" name="Realizada" fill={CHART_COLORS.primary} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {userGroups.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Nenhum work item corresponde aos filtros selecionados.
          </p>
        ) : (
          <div className="space-y-6">
            {userGroups.map((group) => (
              <UserSection key={group.assignee} group={group} />
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-1">Horas por PBI</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Soma das Horas estimadas e realizadas das Tasks vinculadas a cada PBI (via System.Parent), no escopo do
          filtro atual.
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
                {hoursByPbi.slice(0, MAX_PBI_ROWS).map((p) => (
                  <tr key={p.pbiId} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                    <td className="py-1.5 pr-4">{p.pbiTitle}</td>
                    <td className="py-1.5 pr-4 text-right">{p.taskCount}</td>
                    <td className="py-1.5 pr-4 text-right">{formatHours(p.estimatedHours)}</td>
                    <td className="py-1.5 text-right">{formatHours(p.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hoursByPbi.length > MAX_PBI_ROWS && (
              <p className="text-xs mt-2" style={{ color: "var(--color-text-secondary)" }}>
                Mostrando os {MAX_PBI_ROWS} PBIs com mais horas de {hoursByPbi.length}. Refine o filtro de sprint para
                ver os demais.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Agrupamento puro (sem I/O) dos work items do Azure DevOps, usado tanto no
// servidor (lib/services/azure-devops.ts, para o payload inicial) quanto no
// cliente (components/entrega-semanal/azure-breakdown-table.tsx, para
// recalcular as visões ao aplicar os filtros de sprint/responsável sem
// precisar de uma nova requisição).

// Categoria do estado (via Azure DevOps workitemtypes/states, campo `category`)
// — usada só para colorir a badge de State na UI, nunca para decidir
// conclusão/sincronização (isso continua isolado em syncBacklogCompletion).
export type StateCategory = "Proposed" | "InProgress" | "Resolved" | "Completed" | "Removed" | "Other";

export type WorkItemLite = {
  id: number;
  type: string;
  state: string;
  stateCategory: StateCategory;
  sprint: string;
  assignee: string;
  parentId: number | null;
  title: string;
  hours: number;
  estimatedHours: number;
  effort: number | null;
  targetDate: string | null;
  demandType: string | null;
  planning: string | null;
  activity: string | null;
  url: string;
};

// Somar muitos valores de hora em ponto flutuante produz artefatos tipo
// 16711.730000000003 — arredonda pra 2 casas antes de qualquer exibição.
export function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

export type StateGroup = { state: string; count: number; hours: number; estimatedHours: number };
export type TypeGroup = { type: string; count: number; hours: number; estimatedHours: number; states: StateGroup[] };
export type SprintGroup = { sprint: string; count: number; hours: number; estimatedHours: number; types: TypeGroup[] };
export type PbiHours = { pbiId: number; pbiTitle: string; hours: number; estimatedHours: number; taskCount: number };
export type AssigneeHours = { assignee: string; hours: number; estimatedHours: number; count: number };

// Ordem de prioridade pedida: PBI antes de Task. Tipos não listados aqui
// entram depois, em ordem alfabética.
const TYPE_ORDER = ["Product Backlog Item", "Bug", "Task"];

function typeSortIndex(type: string) {
  const idx = TYPE_ORDER.indexOf(type);
  return idx === -1 ? TYPE_ORDER.length : idx;
}

export function buildSprintGroups(items: WorkItemLite[]): SprintGroup[] {
  const sprintMap = new Map<string, SprintGroup>();

  for (const item of items) {
    let sprintGroup = sprintMap.get(item.sprint);
    if (!sprintGroup) {
      sprintGroup = { sprint: item.sprint, count: 0, hours: 0, estimatedHours: 0, types: [] };
      sprintMap.set(item.sprint, sprintGroup);
    }
    sprintGroup.count += 1;
    sprintGroup.hours += item.hours;
    sprintGroup.estimatedHours += item.estimatedHours;

    let typeGroup = sprintGroup.types.find((t) => t.type === item.type);
    if (!typeGroup) {
      typeGroup = { type: item.type, count: 0, hours: 0, estimatedHours: 0, states: [] };
      sprintGroup.types.push(typeGroup);
    }
    typeGroup.count += 1;
    typeGroup.hours += item.hours;
    typeGroup.estimatedHours += item.estimatedHours;

    let stateGroup = typeGroup.states.find((s) => s.state === item.state);
    if (!stateGroup) {
      stateGroup = { state: item.state, count: 0, hours: 0, estimatedHours: 0 };
      typeGroup.states.push(stateGroup);
    }
    stateGroup.count += 1;
    stateGroup.hours += item.hours;
    stateGroup.estimatedHours += item.estimatedHours;
  }

  return Array.from(sprintMap.values())
    .sort((a, b) => a.sprint.localeCompare(b.sprint, "pt-BR", { numeric: true }))
    .map((s) => ({
      ...s,
      hours: roundHours(s.hours),
      estimatedHours: roundHours(s.estimatedHours),
      types: s.types
        .sort((a, b) => typeSortIndex(a.type) - typeSortIndex(b.type))
        .map((t) => ({
          ...t,
          hours: roundHours(t.hours),
          estimatedHours: roundHours(t.estimatedHours),
          states: t.states
            .sort((a, b) => a.state.localeCompare(b.state, "pt-BR"))
            .map((st) => ({ ...st, hours: roundHours(st.hours), estimatedHours: roundHours(st.estimatedHours) })),
        })),
    }));
}

export function buildHoursBySprint(sprints: SprintGroup[]) {
  return sprints.map((s) => ({ sprint: s.sprint, hours: s.hours, estimatedHours: s.estimatedHours, count: s.count }));
}

export function buildHoursByPbi(items: WorkItemLite[]): PbiHours[] {
  const pbiById = new Map<number, string>();
  for (const item of items) {
    if (item.type === "Product Backlog Item") {
      pbiById.set(item.id, item.title || `PBI ${item.id}`);
    }
  }

  const hoursByPbiMap = new Map<number, PbiHours>();
  for (const item of items) {
    if (!item.parentId || !pbiById.has(item.parentId)) continue;
    const existing = hoursByPbiMap.get(item.parentId);
    if (existing) {
      existing.hours += item.hours;
      existing.estimatedHours += item.estimatedHours;
      existing.taskCount += 1;
    } else {
      hoursByPbiMap.set(item.parentId, {
        pbiId: item.parentId,
        pbiTitle: pbiById.get(item.parentId)!,
        hours: item.hours,
        estimatedHours: item.estimatedHours,
        taskCount: 1,
      });
    }
  }

  return Array.from(hoursByPbiMap.values())
    .map((p) => ({ ...p, hours: roundHours(p.hours), estimatedHours: roundHours(p.estimatedHours) }))
    .sort((a, b) => b.hours - a.hours || a.pbiId - b.pbiId);
}

export type UserGroup = {
  assignee: string;
  count: number;
  hours: number;
  estimatedHours: number;
  effort: number;
  items: WorkItemLite[];
};

// Agrupamento operacional por responsável (o fluxo real do time: sprint atual
// × pessoa), usado na aba Azure DevOps de Entrega Semanal. Diferente de
// buildHoursByAssignee (só totais, para o gráfico do Executivo), aqui cada
// grupo carrega os itens em si para a tabela de detalhe.
export function buildUserGroups(items: WorkItemLite[]): UserGroup[] {
  const map = new Map<string, UserGroup>();
  for (const item of items) {
    let group = map.get(item.assignee);
    if (!group) {
      group = { assignee: item.assignee, count: 0, hours: 0, estimatedHours: 0, effort: 0, items: [] };
      map.set(item.assignee, group);
    }
    group.count += 1;
    group.hours += item.hours;
    group.estimatedHours += item.estimatedHours;
    group.effort += item.effort ?? 0;
    group.items.push(item);
  }

  const typeRank = (type: string) => typeSortIndex(type);
  for (const group of map.values()) {
    group.items.sort((a, b) => typeRank(a.type) - typeRank(b.type) || a.title.localeCompare(b.title, "pt-BR"));
  }

  return Array.from(map.values())
    .map((g) => ({ ...g, hours: roundHours(g.hours), estimatedHours: roundHours(g.estimatedHours), effort: roundHours(g.effort) }))
    .sort((a, b) => b.count - a.count || a.assignee.localeCompare(b.assignee, "pt-BR"));
}

export function buildHoursByAssignee(items: WorkItemLite[]): AssigneeHours[] {
  const map = new Map<string, AssigneeHours>();
  for (const item of items) {
    const existing = map.get(item.assignee);
    if (existing) {
      existing.hours += item.hours;
      existing.estimatedHours += item.estimatedHours;
      existing.count += 1;
    } else {
      map.set(item.assignee, { assignee: item.assignee, hours: item.hours, estimatedHours: item.estimatedHours, count: 1 });
    }
  }
  return Array.from(map.values())
    .map((a) => ({ ...a, hours: roundHours(a.hours), estimatedHours: roundHours(a.estimatedHours) }))
    .sort((a, b) => b.hours - a.hours);
}

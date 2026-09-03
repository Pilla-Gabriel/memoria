import { buildSprintGroups, buildHoursBySprint, buildHoursByPbi, buildHoursByAssignee, type WorkItemLite } from "@/lib/azure-work-items";

const ORG = process.env.AZURE_DEVOPS_ORG;
const DEFAULT_PROJECT = process.env.AZURE_DEVOPS_PROJECT;
const PAT = process.env.AZURE_DEVOPS_PAT;

export function isAzureDevOpsConfigured() {
  return Boolean(ORG && DEFAULT_PROJECT && PAT);
}

function escapeWiql(value: string) {
  return value.replace(/'/g, "''");
}

function authHeader() {
  const token = Buffer.from(`:${PAT}`).toString("base64");
  return `Basic ${token}`;
}

async function azureFetch(path: string, init?: RequestInit) {
  const res = await fetch(`https://dev.azure.com/${ORG}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Azure DevOps API respondeu ${res.status} em ${path}`);
  }
  return res.json();
}

type AzureState = { name: string; category: string };

async function getCompletedStates(project: string, workItemType: string): Promise<string[]> {
  const data = await azureFetch(
    `/${encodeURIComponent(project)}/_apis/wit/workitemtypes/${encodeURIComponent(workItemType)}/states?api-version=7.1`
  );
  return (data.value as AzureState[]).filter((s) => s.category === "Completed").map((s) => s.name);
}

async function countByWiql(project: string, wiql: string): Promise<number> {
  const ids = await idsByWiql(project, wiql);
  return ids.length;
}

async function idsByWiql(project: string, wiql: string): Promise<number[]> {
  const data = await azureFetch(`/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.1`, {
    method: "POST",
    body: JSON.stringify({ query: wiql }),
  });
  return (data.workItems ?? []).map((w: { id: number }) => w.id);
}

// Este projeto (Nord) não usa os campos padrão do Scrum
// (Microsoft.VSTS.Scheduling.CompletedWork/OriginalEstimate) — ele tem
// campos customizados próprios para isso, confirmados consultando a task
// 98477 (que tinha 4h em "Horas efetivas" registradas).
const HOURS_ACTUAL_FIELD = "Custom.Horasefetivas";
const HOURS_ESTIMATED_FIELD = "Custom.Horasestimadas";

type AzureWorkItem = {
  id: number;
  fields: {
    "System.Title"?: string;
    "System.WorkItemType"?: string;
    "System.State"?: string;
    "System.IterationPath"?: string;
    "System.Parent"?: number;
    "System.AssignedTo"?: { displayName?: string } | string;
    "Custom.Horasefetivas"?: number;
    "Custom.Horasestimadas"?: number;
  };
};

function assigneeName(item: AzureWorkItem) {
  const assignedTo = item.fields["System.AssignedTo"];
  if (!assignedTo) return "(sem responsável)";
  if (typeof assignedTo === "string") return assignedTo;
  return assignedTo.displayName ?? "(sem responsável)";
}

function actualHours(item: AzureWorkItem) {
  return item.fields[HOURS_ACTUAL_FIELD as "Custom.Horasefetivas"] ?? 0;
}

function estimatedHours(item: AzureWorkItem) {
  return item.fields[HOURS_ESTIMATED_FIELD as "Custom.Horasestimadas"] ?? 0;
}

async function getWorkItemsBatch(project: string, ids: number[]): Promise<AzureWorkItem[]> {
  const fields = [
    "System.Title",
    "System.WorkItemType",
    "System.State",
    "System.IterationPath",
    "System.Parent",
    "System.AssignedTo",
    HOURS_ACTUAL_FIELD,
    HOURS_ESTIMATED_FIELD,
  ].join(",");

  const items: AzureWorkItem[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const data = await azureFetch(
      `/${encodeURIComponent(project)}/_apis/wit/workitems?ids=${chunk.join(",")}&fields=${fields}&api-version=7.1`
    );
    items.push(...(data.value ?? []));
  }
  return items;
}

function shortIterationLabel(iterationPath: string | undefined, project: string) {
  if (!iterationPath) return "(sem sprint)";
  const prefix = `${project}\\`;
  return iterationPath.startsWith(prefix) ? iterationPath.slice(prefix.length) : iterationPath;
}

/**
 * Consulta todos os work items de um projeto do Azure DevOps e agrupa
 * hierarquicamente por Sprint > Type (PBI antes de Task) > State, com o
 * total de itens, a soma de Horas realizadas ("Horas efetivas") e Horas
 * estimadas ("Horas estimadas") em cada nível. Esses são campos
 * customizados do processo do projeto (não os padrões do Scrum do Azure
 * DevOps) — confirmados via a task 98477. Também calcula horas por Sprint e
 * horas por PBI (somando as horas das Tasks filhas via System.Parent).
 * Quando um item não tem o campo preenchido, ele entra como 0 — refletindo
 * o que está de fato registrado, sem inventar números.
 *
 * Inclui a lista de itens (`items`, já no formato leve WorkItemLite) junto
 * com os agregados: o cliente usa isso para recalcular sprints/hoursBySprint
 * /hoursByPbi/hoursByAssignee ao aplicar os filtros de sprint e responsável,
 * sem precisar de uma nova requisição a cada mudança de filtro.
 */
export async function getWorkItemBreakdown(projectOverride?: string) {
  if (!isAzureDevOpsConfigured()) {
    throw new Error("Integração com Azure DevOps não configurada (variáveis de ambiente ausentes).");
  }

  const project = projectOverride || DEFAULT_PROJECT!;
  const escapedProject = escapeWiql(project);

  const ids = await idsByWiql(project, `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapedProject}'`);
  const rawItems = ids.length > 0 ? await getWorkItemsBatch(project, ids) : [];

  const items: WorkItemLite[] = rawItems.map((item) => ({
    id: item.id,
    type: item.fields["System.WorkItemType"] ?? "(sem tipo)",
    state: item.fields["System.State"] ?? "(sem estado)",
    sprint: shortIterationLabel(item.fields["System.IterationPath"], project),
    assignee: assigneeName(item),
    parentId: item.fields["System.Parent"] ?? null,
    title: item.fields["System.Title"] ?? "",
    hours: actualHours(item),
    estimatedHours: estimatedHours(item),
  }));

  const sprints = buildSprintGroups(items);
  const hoursBySprint = buildHoursBySprint(sprints);
  const hoursByPbi = buildHoursByPbi(items);
  const hoursByAssignee = buildHoursByAssignee(items);

  const totalHours = sprints.reduce((acc, s) => acc + s.hours, 0);
  const totalEstimatedHours = sprints.reduce((acc, s) => acc + s.estimatedHours, 0);
  const anyHoursTracked = rawItems.some((i) => typeof i.fields["Custom.Horasefetivas"] === "number");
  const anyEstimatedHoursTracked = rawItems.some((i) => typeof i.fields["Custom.Horasestimadas"] === "number");

  return {
    project,
    totalItems: items.length,
    totalHours,
    totalEstimatedHours,
    anyHoursTracked,
    anyEstimatedHoursTracked,
    items,
    sprints,
    hoursBySprint,
    hoursByPbi,
    hoursByAssignee,
  };
}

/**
 * Calcula % de conclusão para uma lista de tipos de work item (CSV) em um
 * projeto do Azure DevOps: total de itens vs. itens em um estado da
 * categoria "Completed" (detectado dinamicamente por tipo, já que os nomes
 * de estado variam por template de processo).
 */
export async function syncBacklogCompletion(workItemTypesCsv: string, projectOverride?: string) {
  if (!isAzureDevOpsConfigured()) {
    throw new Error("Integração com Azure DevOps não configurada (variáveis de ambiente ausentes).");
  }

  const project = projectOverride || DEFAULT_PROJECT!;
  const types = workItemTypesCsv
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (types.length === 0) {
    throw new Error("Nenhum tipo de work item configurado para esta frente.");
  }

  let total = 0;
  let done = 0;

  for (const type of types) {
    const escapedProject = escapeWiql(project);
    const escapedType = escapeWiql(type);

    const typeTotal = await countByWiql(
      project,
      `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapedProject}' AND [System.WorkItemType] = '${escapedType}'`
    );
    total += typeTotal;

    const completedStates = await getCompletedStates(project, type);
    if (completedStates.length > 0) {
      const stateList = completedStates.map((s) => `'${escapeWiql(s)}'`).join(",");
      const typeDone = await countByWiql(
        project,
        `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapedProject}' AND [System.WorkItemType] = '${escapedType}' AND [System.State] IN (${stateList})`
      );
      done += typeDone;
    }
  }

  const percent = total > 0 ? Math.round((done / total) * 1000) / 10 : 0;

  return { total, done, percent, project, types };
}

import { buildSprintGroups, buildHoursBySprint, buildHoursByPbi, buildHoursByAssignee, type WorkItemLite } from "@/lib/azure-work-items";
import { getCurrentBaseId } from "@/lib/base-context";
import { prisma } from "@/lib/prisma";

// O PAT é uma única credencial global (env), compartilhada por todas as
// bases — elas vivem na mesma organização do Azure DevOps (onclickbr), só o
// projeto muda. Org/projeto vêm da base ativa, com as variáveis de ambiente
// como fallback só para uma base que não tenha os seus próprios definidos.
const PAT = process.env.AZURE_DEVOPS_PAT;

type AzureConfig = { org: string; project: string };

async function activeAzureConfig(): Promise<AzureConfig | null> {
  const baseId = getCurrentBaseId();
  const base = baseId ? await prisma.base.findUnique({ where: { id: baseId } }) : null;

  const org = base?.azureOrg || process.env.AZURE_DEVOPS_ORG;
  const project = base?.azureProject || process.env.AZURE_DEVOPS_PROJECT;
  if (!org || !project) return null;
  return { org, project };
}

export async function isAzureDevOpsConfigured(): Promise<boolean> {
  if (!PAT) return false;
  return (await activeAzureConfig()) !== null;
}

function escapeWiql(value: string) {
  return value.replace(/'/g, "''");
}

function authHeader() {
  const token = Buffer.from(`:${PAT}`).toString("base64");
  return `Basic ${token}`;
}

async function azureFetch(org: string, path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`https://dev.azure.com/${org}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      cache: "no-store",
      // Um PAT inválido/expirado não responde 401 — o Azure DevOps redireciona
      // (302) para a tela de sign-in. Sem "manual", fetch() segue o redirect e
      // a resposta HTML de login passa em res.ok, quebrando mais adiante em
      // res.json() com um erro de parse que não indica a causa real.
      redirect: "manual",
    });
  } catch (err) {
    throw new Error(
      `Falha de rede ao chamar o Azure DevOps em ${path}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (res.status >= 300 && res.status < 400) {
    throw new Error(
      `Azure DevOps redirecionou a chamada em ${path} (status ${res.status}) — isso normalmente indica um AZURE_DEVOPS_PAT inválido ou expirado, não um problema de rede.`
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Azure DevOps API respondeu ${res.status} em ${path}${body ? `: ${body.slice(0, 300)}` : ""}`);
  }

  return res.json();
}

type AzureState = { name: string; category: string };

async function getCompletedStates(org: string, project: string, workItemType: string): Promise<string[]> {
  const data = await azureFetch(
    org,
    `/${encodeURIComponent(project)}/_apis/wit/workitemtypes/${encodeURIComponent(workItemType)}/states?api-version=7.1`
  );
  return (data.value as AzureState[]).filter((s) => s.category === "Completed").map((s) => s.name);
}

async function countByWiql(org: string, project: string, wiql: string): Promise<number> {
  const ids = await idsByWiql(org, project, wiql);
  return ids.length;
}

async function idsByWiql(org: string, project: string, wiql: string): Promise<number[]> {
  const data = await azureFetch(org, `/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.1`, {
    method: "POST",
    body: JSON.stringify({ query: wiql }),
  });
  return (data.workItems ?? []).map((w: { id: number }) => w.id);
}

// Este projeto (Nord) não usa os campos padrão do Scrum
// (Microsoft.VSTS.Scheduling.CompletedWork/OriginalEstimate) — ele tem
// campos customizados próprios para isso, confirmados consultando a task
// 98477 (que tinha 4h em "Horas efetivas" registradas). Confirmado com o
// PAT real que o mesmo campo existe e está preenchido nos 5 projetos.
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

async function getWorkItemsBatch(org: string, project: string, ids: number[]): Promise<AzureWorkItem[]> {
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
      org,
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
 * Consulta todos os work items do projeto do Azure DevOps da base ativa e
 * agrupa hierarquicamente por Sprint > Type (PBI antes de Task) > State, com
 * o total de itens, a soma de Horas realizadas ("Horas efetivas") e Horas
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
  const config = await activeAzureConfig();
  if (!config || !PAT) {
    throw new Error("Integração com Azure DevOps não configurada para a base ativa (nem nas variáveis de ambiente).");
  }

  const { org } = config;
  const project = projectOverride || config.project;
  const escapedProject = escapeWiql(project);

  const ids = await idsByWiql(org, project, `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapedProject}'`);
  const rawItems = ids.length > 0 ? await getWorkItemsBatch(org, project, ids) : [];

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
 * Calcula % de conclusão para uma lista de tipos de work item (CSV) no
 * projeto do Azure DevOps da base ativa: total de itens vs. itens em um
 * estado da categoria "Completed" (detectado dinamicamente por tipo, já que
 * os nomes de estado variam por template de processo).
 */
export async function syncBacklogCompletion(workItemTypesCsv: string, projectOverride?: string) {
  const config = await activeAzureConfig();
  if (!config || !PAT) {
    throw new Error("Integração com Azure DevOps não configurada para a base ativa (nem nas variáveis de ambiente).");
  }

  const { org } = config;
  const project = projectOverride || config.project;
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
      org,
      project,
      `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapedProject}' AND [System.WorkItemType] = '${escapedType}'`
    );
    total += typeTotal;

    const completedStates = await getCompletedStates(org, project, type);
    if (completedStates.length > 0) {
      const stateList = completedStates.map((s) => `'${escapeWiql(s)}'`).join(",");
      const typeDone = await countByWiql(
        org,
        project,
        `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapedProject}' AND [System.WorkItemType] = '${escapedType}' AND [System.State] IN (${stateList})`
      );
      done += typeDone;
    }
  }

  const percent = total > 0 ? Math.round((done / total) * 1000) / 10 : 0;

  return { total, done, percent, project, types };
}

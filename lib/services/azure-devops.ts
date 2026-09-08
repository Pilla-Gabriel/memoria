import { buildSprintGroups, buildHoursBySprint, buildHoursByPbi, buildHoursByAssignee, roundHours, type WorkItemLite } from "@/lib/azure-work-items";
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

const KNOWN_STATE_CATEGORIES = new Set(["Proposed", "InProgress", "Resolved", "Completed", "Removed"]);

// Mapa estado → categoria por tipo de work item (a mesma lista de estados tem
// nomes e categorias diferentes conforme o tipo — ex.: "Aprovado" pode ser
// "InProgress" numa Task e não existir em um Bug). Só usado para colorir a
// badge de State na aba de detalhe; nunca para decidir conclusão de fato
// (isso continua isolado em syncBacklogCompletion/getCompletedStates acima).
async function getStateCategoryMap(org: string, project: string, workItemType: string): Promise<Map<string, string>> {
  const data = await azureFetch(
    org,
    `/${encodeURIComponent(project)}/_apis/wit/workitemtypes/${encodeURIComponent(workItemType)}/states?api-version=7.1`
  );
  const map = new Map<string, string>();
  for (const s of data.value as AzureState[]) {
    map.set(s.name, KNOWN_STATE_CATEGORIES.has(s.category) ? s.category : "Other");
  }
  return map;
}

type AzureIteration = {
  path: string;
  attributes: { timeFrame: "past" | "current" | "future" };
};

// Resolve a sprint "atual" do time consultando a API de iterações do Azure
// DevOps (que já classifica cada uma como past/current/future no próprio
// agendamento do time) — evita depender de string matching ou de datas que
// este processo não preenche (ver Base.azureOrg/azureProject e o comentário
// em activeAzureConfig). Sem iteração "current" (sprint ainda não começou ou
// já terminou todas), cai para a última "past"; sem nenhuma, a primeira
// "future"; projeto sem nenhuma iteração configurada retorna null.
async function getCurrentSprintLabel(org: string, project: string): Promise<string | null> {
  try {
    const teams = await azureFetch(org, `/_apis/projects/${encodeURIComponent(project)}/teams?api-version=7.1`);
    const team = teams.value?.[0]?.name;
    if (!team) return null;

    const data = await azureFetch(
      org,
      `/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations?api-version=7.1`
    );
    const iterations = (data.value ?? []) as AzureIteration[];
    if (iterations.length === 0) return null;

    const current = iterations.find((i) => i.attributes.timeFrame === "current");
    const chosen = current ?? [...iterations].reverse().find((i) => i.attributes.timeFrame === "past") ?? iterations.find((i) => i.attributes.timeFrame === "future");
    return chosen ? shortIterationLabel(chosen.path, project) : null;
  } catch {
    // Sem time/iterações configuradas no Azure DevOps para este projeto —
    // degrada para "nenhuma sprint atual detectada" em vez de quebrar o
    // breakdown inteiro por causa de um dado auxiliar.
    return null;
  }
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

// Effort/Target Date são campos padrão do Azure Boards; Tipo de demanda,
// Planejamento e Activity são específicos do template de processo da
// organização (confirmados via /_apis/wit/fields — nomes e uso variam por
// projeto: nem todo projeto os preenche, ex.: Nord ainda não usa nenhum
// deles, enquanto KPL usa os 5).
const EFFORT_FIELD = "Microsoft.VSTS.Scheduling.Effort";
const TARGET_DATE_FIELD = "Microsoft.VSTS.Scheduling.TargetDate";
const ACTIVITY_FIELD = "Microsoft.VSTS.Common.Activity";
const DEMAND_TYPE_FIELD = "Custom.Tipodedemanda";
const PLANNING_FIELD = "Custom.Planejamento";

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
    "Microsoft.VSTS.Scheduling.Effort"?: number;
    "Microsoft.VSTS.Scheduling.TargetDate"?: string;
    "Microsoft.VSTS.Common.Activity"?: string;
    "Custom.Tipodedemanda"?: string;
    "Custom.Planejamento"?: string;
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
    EFFORT_FIELD,
    TARGET_DATE_FIELD,
    ACTIVITY_FIELD,
    DEMAND_TYPE_FIELD,
    PLANNING_FIELD,
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

  const typesPresent = Array.from(new Set(rawItems.map((i) => i.fields["System.WorkItemType"]).filter((t): t is string => !!t)));
  const [stateCategoryMaps, currentSprintLabel] = await Promise.all([
    Promise.all(typesPresent.map((type) => getStateCategoryMap(org, project, type).then((map) => [type, map] as const))),
    getCurrentSprintLabel(org, project),
  ]);
  const stateCategoryByType = new Map(stateCategoryMaps);

  const items: WorkItemLite[] = rawItems.map((item) => {
    const type = item.fields["System.WorkItemType"] ?? "(sem tipo)";
    const state = item.fields["System.State"] ?? "(sem estado)";
    const category = stateCategoryByType.get(type)?.get(state);
    return {
      id: item.id,
      type,
      state,
      stateCategory: (category ?? "Other") as WorkItemLite["stateCategory"],
      sprint: shortIterationLabel(item.fields["System.IterationPath"], project),
      assignee: assigneeName(item),
      parentId: item.fields["System.Parent"] ?? null,
      title: item.fields["System.Title"] ?? "",
      hours: actualHours(item),
      estimatedHours: estimatedHours(item),
      effort: item.fields[EFFORT_FIELD as "Microsoft.VSTS.Scheduling.Effort"] ?? null,
      targetDate: item.fields[TARGET_DATE_FIELD as "Microsoft.VSTS.Scheduling.TargetDate"] ?? null,
      demandType: item.fields[DEMAND_TYPE_FIELD as "Custom.Tipodedemanda"] ?? null,
      planning: item.fields[PLANNING_FIELD as "Custom.Planejamento"] ?? null,
      activity: item.fields[ACTIVITY_FIELD as "Microsoft.VSTS.Common.Activity"] ?? null,
      url: `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_workitems/edit/${item.id}`,
    };
  });

  const sprints = buildSprintGroups(items);
  const hoursBySprint = buildHoursBySprint(sprints);
  const hoursByPbi = buildHoursByPbi(items);
  const hoursByAssignee = buildHoursByAssignee(items);

  const totalHours = roundHours(sprints.reduce((acc, s) => acc + s.hours, 0));
  const totalEstimatedHours = roundHours(sprints.reduce((acc, s) => acc + s.estimatedHours, 0));
  const anyHoursTracked = rawItems.some((i) => typeof i.fields["Custom.Horasefetivas"] === "number");
  const anyEstimatedHoursTracked = rawItems.some((i) => typeof i.fields["Custom.Horasestimadas"] === "number");
  // Cada organização usa um subconjunto diferente destes 5 campos (nenhum
  // deles obrigatório) — sem isso, uma coluna inteira de "—" fica ambígua:
  // ninguém preencheu ainda, ou este processo simplesmente não usa o campo?
  // A UI usa essas flags pra avisar quando é o segundo caso.
  const anyEffortTracked = rawItems.some((i) => typeof i.fields[EFFORT_FIELD as "Microsoft.VSTS.Scheduling.Effort"] === "number");
  const anyTargetDateTracked = rawItems.some((i) => !!i.fields[TARGET_DATE_FIELD as "Microsoft.VSTS.Scheduling.TargetDate"]);
  const anyDemandTypeTracked = rawItems.some((i) => !!i.fields[DEMAND_TYPE_FIELD as "Custom.Tipodedemanda"]);
  const anyPlanningTracked = rawItems.some((i) => !!i.fields[PLANNING_FIELD as "Custom.Planejamento"]);
  const anyActivityTracked = rawItems.some((i) => !!i.fields[ACTIVITY_FIELD as "Microsoft.VSTS.Common.Activity"]);

  return {
    project,
    totalItems: items.length,
    totalHours,
    totalEstimatedHours,
    anyHoursTracked,
    anyEstimatedHoursTracked,
    anyEffortTracked,
    anyTargetDateTracked,
    anyDemandTypeTracked,
    anyPlanningTracked,
    anyActivityTracked,
    currentSprintLabel,
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

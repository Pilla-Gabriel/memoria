import { prisma } from "@/lib/prisma";
import { daysBetween } from "@/lib/services/risk-engine";
import { logAudit } from "@/lib/audit";
import { syncBacklogCompletion, isAzureDevOpsConfigured } from "@/lib/services/azure-devops";

export function evaluateFrenteRisk(frente: {
  targetDate: Date;
  baselineValue: number;
  currentValue: number;
  targetValue: number;
}): boolean {
  const daysRemaining = daysBetween(frente.targetDate, new Date()) * -1;
  if (daysRemaining < 0) return true;

  const range = frente.targetValue - frente.baselineValue;
  const progress = range !== 0 ? (frente.currentValue - frente.baselineValue) / range : 1;

  return daysRemaining <= 7 && progress < 0.7;
}

export async function getWindowStartFor(createdById: string, weekStart: Date) {
  const lastReport = await prisma.weeklyReport.findFirst({
    where: { createdById, weekStart: { lt: weekStart } },
    orderBy: { weekStart: "desc" },
  });
  return lastReport?.weekStart ?? new Date(0);
}

export async function computeFrenteComparison(frenteId: string, windowStart: Date) {
  const frente = await prisma.frente.findUniqueOrThrow({ where: { id: frenteId } });

  const previousSnapshot = await prisma.frenteSnapshot.findFirst({
    where: { frenteId, createdAt: { lte: windowStart } },
    orderBy: { createdAt: "desc" },
  });
  const previousValue = previousSnapshot?.value ?? frente.baselineValue;

  const deliveries = await prisma.delivery.findMany({
    where: { frenteId, deliveredAt: { gte: windowStart } },
    include: { deliveredBy: { select: { name: true } } },
    orderBy: { deliveredAt: "desc" },
  });

  const openBlockers = await prisma.blocker.findMany({
    where: { frenteId, status: "ABERTO" },
    include: {
      ownerToUnblock: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const deltaAbs = frente.currentValue - previousValue;
  const deltaPct = previousValue !== 0 ? (deltaAbs / Math.abs(previousValue)) * 100 : null;

  return {
    frente,
    previousValue,
    currentValue: frente.currentValue,
    targetValue: frente.targetValue,
    deltaAbs,
    deltaPct,
    deliveries,
    openBlockers,
    isAtRisk: evaluateFrenteRisk(frente),
  };
}

export async function getEntregaSemanalSummary() {
  const frentes = await prisma.frente.findMany({
    where: { active: true },
    include: { _count: { select: { blockers: { where: { status: "ABERTO" } } } } },
    orderBy: { createdAt: "asc" },
  });

  const emRisco = frentes.filter((f) => evaluateFrenteRisk(f));
  const openBlockers = frentes.reduce((acc, f) => acc + f._count.blockers, 0);

  const azureFrentes = frentes.filter((f) => f.source === "AZURE_DEVOPS" && f.azureWorkItemTypes);
  const lastAzureSnapshot = azureFrentes.length
    ? await prisma.frenteSnapshot.findFirst({
        where: { frenteId: { in: azureFrentes.map((f) => f.id) }, note: { contains: "Azure DevOps" } },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return {
    totalFrentes: frentes.length,
    frentesEmRisco: emRisco.length,
    openBlockers,
    azureConfigured: azureFrentes.length > 0,
    azureFrenteCount: azureFrentes.length,
    lastAzureSyncAt: lastAzureSnapshot?.createdAt ?? null,
    frentes,
  };
}

export function threeLineSummary(comparison: Awaited<ReturnType<typeof computeFrenteComparison>>) {
  const { frente, previousValue, currentValue, targetValue, deliveries, openBlockers } = comparison;

  const line1 = `Estava em ${previousValue} ${frente.unit}, está em ${currentValue} ${frente.unit} e a meta é ${targetValue} ${frente.unit}.`;

  const line2 = deliveries.length
    ? `Ficou pronto: ${deliveries.map((d) => `${d.title} (${d.evidence})`).join("; ")}.`
    : "Ficou pronto: nenhuma entrega registrada no período.";

  const line3 = openBlockers.length
    ? `Está travado: ${openBlockers
        .map((b) => `${b.description} — impacto: ${b.impact} — destrava: ${b.ownerToUnblock?.name ?? b.ownerToUnblockName ?? "a definir"}`)
        .join("; ")}.`
    : "Está travado: nada travado no momento.";

  return { line1, line2, line3 };
}

/**
 * Sincroniza todas as frentes ativas ligadas ao Azure DevOps. Compartilhada
 * pelo endpoint acionado manualmente (botão "Sincronizar") e pelo job
 * agendado em server.ts — o botão vira um atalho para forçar uma sincronização
 * fora do ciclo automático, não a única forma de manter os números em dia.
 */
export async function syncAllAzureFrentes(actorUserId: string) {
  if (!(await isAzureDevOpsConfigured())) {
    throw new Error("Integração com Azure DevOps não configurada.");
  }

  const frentes = await prisma.frente.findMany({
    where: { active: true, source: "AZURE_DEVOPS", azureWorkItemTypes: { not: null } },
  });

  const results = [];
  for (const frente of frentes) {
    try {
      const result = await syncBacklogCompletion(frente.azureWorkItemTypes!);
      const value = frente.unit === "%" ? result.percent : result.done;

      await prisma.frenteSnapshot.create({
        data: {
          frenteId: frente.id,
          value,
          note: `Sincronizado via Azure DevOps: ${result.done}/${result.total} itens concluídos (${result.types.join(", ")}).`,
          createdById: actorUserId,
        },
      });
      await prisma.frente.update({ where: { id: frente.id }, data: { currentValue: value } });
      await logAudit({
        entityType: "Frente",
        entityId: frente.id,
        action: "SINCRONIZADO_AZURE_DEVOPS",
        field: "currentValue",
        oldValue: String(frente.currentValue),
        newValue: String(value),
        userId: actorUserId,
      });

      results.push({ frenteId: frente.id, name: frente.name, ok: true, ...result });
    } catch (err) {
      results.push({
        frenteId: frente.id,
        name: frente.name,
        ok: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  return results;
}

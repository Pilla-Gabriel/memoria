import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVisibleUserIds, isManager } from "@/lib/rbac";
import { computeUserRiskProfile } from "@/lib/services/risk-engine";
import { getEntregaSemanalSummary } from "@/lib/services/frentes";
import { isAzureDevOpsConfigured } from "@/lib/services/azure-devops";
import { withBase } from "@/lib/with-base";

export const GET = withBase(async (_request, _ctx, session) => {
  if (!isManager(session.user.role)) {
    return NextResponse.json({ error: "Acesso restrito a líderes e administradores" }, { status: 403 });
  }

  const visibleIds = await getVisibleUserIds(session.user);
  const ownerFilter = visibleIds ? { in: visibleIds } : undefined;

  const [statusCounts, users, extensionsCount, checkinRecovered, goalsAtingidas, goalsVencidas, checkinsIgnorados] =
    await Promise.all([
      prisma.task.groupBy({
        by: ["status"],
        where: { ownerId: ownerFilter },
        _count: { _all: true },
      }),
      prisma.user.findMany({
        where: visibleIds ? { id: { in: visibleIds } } : {},
        select: { id: true, name: true },
      }),
      prisma.taskExtensionRequest.count({
        where: { task: { ownerId: ownerFilter }, status: { in: ["AUTO_APROVADA", "APROVADA"] } },
      }),
      prisma.task.count({
        where: { ownerId: ownerFilter, origin: { in: ["CHECKIN", "REVISAO_SEMANAL"] } },
      }),
      prisma.goal.count({ where: { ownerId: ownerFilter, status: "ATINGIDA" } }),
      prisma.goal.count({ where: { ownerId: ownerFilter, status: "VENCIDA" } }),
      prisma.checkInSession.count({ where: { userId: ownerFilter, status: "IGNORADO" } }),
    ]);

  const totalTasks = statusCounts.reduce((acc, c) => acc + c._count._all, 0);
  const concluida = statusCounts.find((c) => c.status === "CONCLUIDA")?._count._all ?? 0;
  const atrasada = statusCounts.find((c) => c.status === "ATRASADA")?._count._all ?? 0;
  const cancelada = statusCounts.find((c) => c.status === "CANCELADA")?._count._all ?? 0;

  const taxaConclusao = totalTasks - cancelada > 0 ? Math.round((concluida / (totalTasks - cancelada)) * 100) : 0;
  const taxaAtraso = totalTasks - cancelada > 0 ? Math.round((atrasada / (totalTasks - cancelada)) * 100) : 0;

  const completedWithDates = await prisma.task.findMany({
    where: { ownerId: ownerFilter, status: "CONCLUIDA", completedAt: { not: null } },
    select: { createdAt: true, completedAt: true },
  });
  const avgCompletionDays =
    completedWithDates.length > 0
      ? Math.round(
          completedWithDates.reduce(
            (acc, t) => acc + (t.completedAt!.getTime() - t.createdAt.getTime()) / 86400000,
            0
          ) / completedWithDates.length
        )
      : 0;

  const productivity = await Promise.all(
    users.map(async (u) => {
      const completedCount = await prisma.task.count({ where: { ownerId: u.id, status: "CONCLUIDA" } });
      const ignoredCheckinsCount = await prisma.checkInSession.count({
        where: { userId: u.id, status: "IGNORADO" },
      });
      const risk = await computeUserRiskProfile(u.id);
      return { id: u.id, name: u.name, completedCount, ignoredCheckinsCount, ...risk };
    })
  );

  const topProductive = [...productivity].sort((a, b) => b.completedCount - a.completedCount).slice(0, 5);
  const topDelayed = [...productivity]
    .filter((p) => p.countDelays > 0)
    .sort((a, b) => b.countDelays - a.countDelays)
    .slice(0, 5);
  const topIgnoredCheckins = [...productivity]
    .filter((p) => p.ignoredCheckinsCount > 0)
    .sort((a, b) => b.ignoredCheckinsCount - a.ignoredCheckinsCount)
    .slice(0, 5);

  const entregaSemanal = await getEntregaSemanalSummary();

  return NextResponse.json({
    statusCounts: statusCounts.map((c) => ({ status: c.status, count: c._count._all })),
    taxaConclusao,
    taxaAtraso,
    avgCompletionDays,
    extensionsCount,
    checkinRecovered,
    goalsAtingidas,
    goalsVencidas,
    checkinsIgnorados,
    topProductive,
    topDelayed,
    topIgnoredCheckins,
    entregaSemanal: {
      totalFrentes: entregaSemanal.totalFrentes,
      frentesEmRisco: entregaSemanal.frentesEmRisco,
      openBlockers: entregaSemanal.openBlockers,
      azureEnv: await isAzureDevOpsConfigured(),
      azureConfigured: entregaSemanal.azureConfigured,
      azureFrenteCount: entregaSemanal.azureFrenteCount,
      lastAzureSyncAt: entregaSemanal.lastAzureSyncAt,
    },
  });
});

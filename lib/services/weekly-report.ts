import { prisma } from "@/lib/prisma";
import { computeFrenteComparison, getWindowStartFor } from "@/lib/services/frentes";
import { requireBaseId } from "@/lib/base-context";
import { getActiveUserIdsWithBaseAccess } from "@/lib/base-access";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mondayOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Cria (se ainda não existir) um rascunho de relatório semanal para cada
 * líder/administrador ativo — são eles que normalmente reportam à liderança.
 */
export async function ensureWeeklyReportDrafts(kind: "SEGUNDA" | "SEXTA", date: Date = new Date()) {
  const weekStart = mondayOfWeek(date);
  const baseId = requireBaseId();
  const accessibleUserIds = await getActiveUserIdsWithBaseAccess(baseId);
  const reporters = await prisma.user.findMany({
    where: { id: { in: accessibleUserIds }, role: { in: ["LEADER", "ADMIN"] } },
    select: { id: true },
  });

  const created: string[] = [];
  for (const reporter of reporters) {
    const existing = await prisma.weeklyReport.findFirst({
      where: { createdById: reporter.id, kind, weekStart },
    });
    if (existing) continue;

    const report = await prisma.weeklyReport.create({
      data: { createdById: reporter.id, kind, weekStart, baseId },
    });

    await prisma.alert.create({
      data: {
        userId: reporter.id,
        type: "CHECKIN_PENDENTE",
        relatedType: "WeeklyReport",
        relatedId: report.id,
        message:
          kind === "SEGUNDA"
            ? "O relatório de Entrega Semanal de segunda-feira está pronto para ser preenchido."
            : "O relatório de Entrega Semanal de sexta-feira está pronto para ser preenchido.",
        baseId,
      },
    });

    created.push(report.id);
  }

  return created;
}

export async function buildWeeklyReportData(reportId: string) {
  const report = await prisma.weeklyReport.findUniqueOrThrow({
    where: { id: reportId },
    include: { createdBy: { select: { id: true, name: true, role: true } } },
  });

  const windowStart = await getWindowStartFor(report.createdById, report.weekStart);
  const frentes = await prisma.frente.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });

  const comparisons = await Promise.all(frentes.map((f) => computeFrenteComparison(f.id, windowStart)));

  return { report, windowStart, comparisons };
}

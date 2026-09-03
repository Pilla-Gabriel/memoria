import { prisma } from "@/lib/prisma";

export type RiskLevel = "BAIXO" | "MEDIO" | "ALTO" | "CRITICO";

// Compartilhado com lib/services/alerts.ts: depois desse número de dias sem
// prazo, uma tarefa passa a contar como atraso no risco do usuário, do mesmo
// jeito que uma tarefa vencida — sem isso ela ficava invisível para
// computeUserRiskProfile só por nunca ter recebido um prazo.
export const NO_DUE_DATE_GRACE_DAYS = 3;

export function daysBetween(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function classifyRisk(countDelays: number, avgDelayDays: number, maxActiveDelayDays: number): RiskLevel {
  if (countDelays >= 5 || maxActiveDelayDays > 14) return "CRITICO";
  if (countDelays >= 3 || avgDelayDays > 5 || maxActiveDelayDays > 7) return "ALTO";
  if (countDelays >= 1 || maxActiveDelayDays > 0) return "MEDIO";
  return "BAIXO";
}

export async function computeUserRiskProfile(userId: string) {
  const now = new Date();

  const [lateActive, completedLate, staleNoDueDate] = await Promise.all([
    prisma.task.findMany({
      where: { ownerId: userId, status: "ATRASADA", dueDate: { not: null } },
      select: { dueDate: true },
    }),
    prisma.task.findMany({
      where: {
        ownerId: userId,
        status: "CONCLUIDA",
        dueDate: { not: null },
        completedAt: { not: null },
      },
      select: { dueDate: true, completedAt: true },
    }),
    prisma.task.findMany({
      where: {
        ownerId: userId,
        status: { notIn: ["CONCLUIDA", "CANCELADA"] },
        needsDueDate: true,
        dueDate: null,
      },
      select: { createdAt: true },
    }),
  ]);

  const completedLateFiltered = completedLate.filter(
    (t) => t.completedAt && t.dueDate && t.completedAt > t.dueDate
  );

  // Tarefa sem prazo além do período de carência conta como atraso: "dias de
  // atraso" aqui é o tempo além da carência, não o tempo total sem prazo.
  const staleNoDueDateFiltered = staleNoDueDate
    .map((t) => daysBetween(now, t.createdAt) - NO_DUE_DATE_GRACE_DAYS)
    .filter((days) => days > 0);

  const delayDays: number[] = [
    ...lateActive.map((t) => daysBetween(now, t.dueDate as Date)),
    ...completedLateFiltered.map((t) => daysBetween(t.completedAt as Date, t.dueDate as Date)),
    ...staleNoDueDateFiltered,
  ];

  const countDelays = lateActive.length + completedLateFiltered.length + staleNoDueDateFiltered.length;
  const avgDelayDays = delayDays.length ? delayDays.reduce((a, b) => a + b, 0) / delayDays.length : 0;
  const activeDelayDays = [
    ...lateActive.map((t) => daysBetween(now, t.dueDate as Date)),
    ...staleNoDueDateFiltered,
  ];
  const maxActiveDelayDays = activeDelayDays.length ? Math.max(...activeDelayDays) : 0;

  return {
    countDelays,
    avgDelayDays: Math.round(avgDelayDays * 10) / 10,
    maxActiveDelayDays,
    classification: classifyRisk(countDelays, avgDelayDays, maxActiveDelayDays),
  };
}

export function evaluateGoalStatus(goal: {
  status: string;
  dueDate: Date;
  currentValue: number;
  targetValue: number;
}): "EM_ANDAMENTO" | "ATINGIDA" | "EM_RISCO" | "VENCIDA" | "CANCELADA" {
  if (goal.status === "CANCELADA" || goal.status === "ATINGIDA") {
    return goal.status;
  }

  if (goal.currentValue >= goal.targetValue) {
    return "ATINGIDA";
  }

  const now = new Date();
  const daysRemaining = daysBetween(goal.dueDate, now) * -1;

  if (daysRemaining < 0) {
    return "VENCIDA";
  }

  const progressRatio = goal.targetValue > 0 ? goal.currentValue / goal.targetValue : 0;

  if (daysRemaining <= 3 && progressRatio < 0.8) {
    return "EM_RISCO";
  }

  return "EM_ANDAMENTO";
}

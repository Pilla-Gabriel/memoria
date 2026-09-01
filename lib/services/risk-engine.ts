import { prisma } from "@/lib/prisma";

export type RiskLevel = "BAIXO" | "MEDIO" | "ALTO" | "CRITICO";

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

  const [lateActive, completedLate] = await Promise.all([
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
  ]);

  const completedLateFiltered = completedLate.filter(
    (t) => t.completedAt && t.dueDate && t.completedAt > t.dueDate
  );

  const delayDays: number[] = [
    ...lateActive.map((t) => daysBetween(now, t.dueDate as Date)),
    ...completedLateFiltered.map((t) => daysBetween(t.completedAt as Date, t.dueDate as Date)),
  ];

  const countDelays = lateActive.length + completedLateFiltered.length;
  const avgDelayDays = delayDays.length ? delayDays.reduce((a, b) => a + b, 0) / delayDays.length : 0;
  const maxActiveDelayDays = lateActive.length
    ? Math.max(...lateActive.map((t) => daysBetween(now, t.dueDate as Date)))
    : 0;

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

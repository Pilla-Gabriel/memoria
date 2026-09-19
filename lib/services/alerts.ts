import { prisma } from "@/lib/prisma";
import { daysBetween, evaluateGoalStatus, NO_DUE_DATE_GRACE_DAYS } from "@/lib/services/risk-engine";
import { evaluateFrenteRisk } from "@/lib/services/frentes";
import { markStaleSessionsAsIgnored, getEffectiveActiveSlotsFor } from "@/lib/services/checkin";
import { effectiveListFor } from "@/lib/services/personalization";
import { getActiveUserIdsWithBaseAccess } from "@/lib/base-access";
import { notifyUser, type AlertKind } from "@/lib/services/notifications";
import { logAudit } from "@/lib/audit";
import { requireBaseId } from "@/lib/base-context";

const FRENTE_STALE_DAYS = 5;
const AUTO_DUE_DATE_WINDOW_DAYS = 3;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function createAlertOnce(params: { userId: string; type: AlertKind; relatedType: string; relatedId: string; message: string }) {
  const today = startOfDay(new Date());
  const existing = await prisma.alert.findFirst({
    where: {
      userId: params.userId,
      type: params.type,
      relatedType: params.relatedType,
      relatedId: params.relatedId,
      createdAt: { gte: today },
    },
  });
  if (existing) return;

  await notifyUser(params);
}

export async function generateTaskAlerts() {
  const now = new Date();
  const tasks = await prisma.task.findMany({
    where: { status: { notIn: ["CONCLUIDA", "CANCELADA"] } },
  });

  for (const task of tasks) {
    if (!task.dueDate) {
      if (task.needsDueDate) {
        const daysSinceCreated = daysBetween(now, task.createdAt);

        if (daysSinceCreated >= NO_DUE_DATE_GRACE_DAYS) {
          const autoDueDate = new Date(now.getTime() + AUTO_DUE_DATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
          await prisma.task.update({
            where: { id: task.id },
            data: { dueDate: autoDueDate, needsDueDate: false },
          });
          await logAudit({
            entityType: "Task",
            entityId: task.id,
            action: "PRAZO_ATRIBUIDO_AUTOMATICO",
            field: "dueDate",
            oldValue: null,
            newValue: autoDueDate.toISOString(),
            userId: task.ownerId,
          });
          await createAlertOnce({
            userId: task.ownerId,
            type: "SEM_PRAZO",
            relatedType: "Task",
            relatedId: task.id,
            message: `A tarefa "${task.title}" ficou ${NO_DUE_DATE_GRACE_DAYS} dias sem prazo — um prazo de ${AUTO_DUE_DATE_WINDOW_DAYS} dias foi definido automaticamente.`,
          });
        } else {
          await createAlertOnce({
            userId: task.ownerId,
            type: "SEM_PRAZO",
            relatedType: "Task",
            relatedId: task.id,
            message: `A tarefa "${task.title}" ainda não tem prazo definido.`,
          });
        }
      }
      continue;
    }

    const daysUntilDue = daysBetween(task.dueDate, now) * -1;

    if (daysUntilDue < 0 && task.status !== "ATRASADA") {
      await prisma.task.update({ where: { id: task.id }, data: { status: "ATRASADA" } });
      await logAudit({
        entityType: "Task",
        entityId: task.id,
        action: "STATUS_ATRASADA_AUTOMATICO",
        field: "status",
        oldValue: task.status,
        newValue: "ATRASADA",
        userId: task.ownerId,
      });
    }

    if (daysUntilDue < 0) {
      await createAlertOnce({
        userId: task.ownerId,
        type: "ATRASADA",
        relatedType: "Task",
        relatedId: task.id,
        message: `A tarefa "${task.title}" está atrasada.`,
      });
    } else if (daysUntilDue === 0) {
      await createAlertOnce({
        userId: task.ownerId,
        type: "VENCE_HOJE",
        relatedType: "Task",
        relatedId: task.id,
        message: `A tarefa "${task.title}" vence hoje.`,
      });
    } else if (daysUntilDue === 1) {
      await createAlertOnce({
        userId: task.ownerId,
        type: "PRAZO_1D",
        relatedType: "Task",
        relatedId: task.id,
        message: `Falta 1 dia para o prazo da tarefa "${task.title}".`,
      });
    } else if (daysUntilDue === 3) {
      await createAlertOnce({
        userId: task.ownerId,
        type: "PRAZO_3D",
        relatedType: "Task",
        relatedId: task.id,
        message: `Faltam 3 dias para o prazo da tarefa "${task.title}".`,
      });
    } else if (daysUntilDue === 7) {
      await createAlertOnce({
        userId: task.ownerId,
        type: "PRAZO_7D",
        relatedType: "Task",
        relatedId: task.id,
        message: `Faltam 7 dias para o prazo da tarefa "${task.title}".`,
      });
    }
  }
}

export async function generateGoalAlerts() {
  const goals = await prisma.goal.findMany({
    where: { status: { notIn: ["ATINGIDA", "CANCELADA"] } },
  });

  for (const goal of goals) {
    const nextStatus = evaluateGoalStatus(goal);

    if (nextStatus !== goal.status) {
      await prisma.goal.update({ where: { id: goal.id }, data: { status: nextStatus } });
      await logAudit({
        entityType: "Goal",
        entityId: goal.id,
        action: "STATUS_ATUALIZADO_AUTOMATICO",
        field: "status",
        oldValue: goal.status,
        newValue: nextStatus,
        userId: goal.ownerId,
      });
    }

    if (nextStatus === "EM_RISCO") {
      await createAlertOnce({
        userId: goal.ownerId,
        type: "META_RISCO",
        relatedType: "Goal",
        relatedId: goal.id,
        message: `A meta "${goal.title}" está em risco de não ser atingida no prazo.`,
      });
    } else if (nextStatus === "VENCIDA") {
      await createAlertOnce({
        userId: goal.ownerId,
        type: "META_VENCIDA",
        relatedType: "Goal",
        relatedId: goal.id,
        message: `A meta "${goal.title}" venceu sem ser concluída.`,
      });
    }
  }
}

export async function generateFrenteAlerts() {
  const now = new Date();
  const frentes = await prisma.frente.findMany({
    where: { active: true },
    include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  for (const frente of frentes) {
    if (evaluateFrenteRisk(frente)) {
      await createAlertOnce({
        userId: frente.ownerId,
        type: "FRENTE_EM_RISCO",
        relatedType: "Frente",
        relatedId: frente.id,
        message: `A frente "${frente.name}" está em risco de não atingir a meta de 30 dias.`,
      });
    }

    const lastUpdate = frente.snapshots[0]?.createdAt ?? frente.createdAt;
    if (daysBetween(now, lastUpdate) >= FRENTE_STALE_DAYS) {
      await createAlertOnce({
        userId: frente.ownerId,
        type: "FRENTE_SEM_ATUALIZACAO",
        relatedType: "Frente",
        relatedId: frente.id,
        message: `A frente "${frente.name}" está sem atualização de número há ${FRENTE_STALE_DAYS} dias ou mais.`,
      });
    }
  }
}

// Horários e perguntas de check-in são personalizáveis por usuário (ver
// lib/services/personalization.ts) — desativar todos os próprios sem deixar
// rastro seria a mesma brecha que os demais generateXAlerts já fecham pra
// tarefa/meta/frente, só que por uma porta nova: sem isso, alguém que
// desativa todo o próprio horário simplesmente para de receber check-in pra
// sempre, sem alerta nenhum pra ela ou pra quem lidera.
export async function generateCheckInConfigAlerts() {
  const baseId = requireBaseId();
  const userIds = await getActiveUserIdsWithBaseAccess(baseId);

  for (const userId of userIds) {
    const slots = await getEffectiveActiveSlotsFor(userId);
    if (slots.length === 0) {
      await createAlertOnce({
        userId,
        type: "CHECKIN_NAO_CONFIGURADO",
        relatedType: "CheckInConfig",
        relatedId: `${userId}:slots`,
        message: "Você não tem nenhum horário de check-in ativo — configure ao menos um em Configurações para voltar a receber check-ins.",
      });
      continue; // sem horário, o check-in diário nem chega a ser criado — checar perguntas não ajuda ainda
    }

    const dailyQuestions = await effectiveListFor(prisma.checkInQuestion, userId, { category: "DAILY" });
    if (!dailyQuestions.some((q) => q.active)) {
      await createAlertOnce({
        userId,
        type: "CHECKIN_NAO_CONFIGURADO",
        relatedType: "CheckInConfig",
        relatedId: `${userId}:daily`,
        message: "Você não tem nenhuma pergunta ativa para o check-in diário — configure ao menos uma em Configurações.",
      });
    }
  }
}

export async function runDailyAlertsJob() {
  await markStaleSessionsAsIgnored();
  await generateTaskAlerts();
  await generateGoalAlerts();
  await generateFrenteAlerts();
  await generateCheckInConfigAlerts();
}

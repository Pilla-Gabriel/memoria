import { prisma } from "@/lib/prisma";
import { requireBaseId } from "@/lib/base-context";
import { getActiveUserIdsWithBaseAccess } from "@/lib/base-access";
import { effectiveListFor } from "@/lib/services/personalization";
import { notifyUser } from "@/lib/services/notifications";

const ACTION_MARKERS = [
  "preciso",
  "precisamos",
  "vou ",
  "tenho que",
  "temos que",
  "devo ",
  "devemos",
  "falta ",
  "faltam",
  "pendente",
  "ainda não",
  "não consegui",
  "combinei",
  "ficou de",
  "fica de",
  "necessário",
  "necessario",
  "tenho de",
  "preciso de",
  "cobrar",
  "resolver",
  "enviar",
  "validar",
  "finalizar",
  "concluir",
  "retornar",
];

/**
 * Heurística nativa e determinística (sem IA): marca a resposta como
 * acionável quando contém verbos/marcadores típicos de compromisso.
 */
export function isActionableAnswer(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (normalized.trim().length < 4) return false;
  if (/^(n[aã]o|nenhum[a]?|nada|ok|sim)\.?$/.test(normalized.trim())) return false;

  return ACTION_MARKERS.some((marker) => {
    const m = marker.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return normalized.includes(m);
  });
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Lista efetiva de horários ativos de um usuário: os padrões que ele não
// personalizou, mais os pessoais (criações próprias e cópias que substituem
// um padrão editado/"excluído" — ver lib/services/personalization.ts).
export async function getEffectiveActiveSlotsFor(userId: string) {
  const slots = await effectiveListFor(prisma.checkInSlot, userId);
  return slots.filter((s) => s.active);
}

export async function getQuestionsFor(userId: string, kind: "DAILY" | "MONDAY_REVIEW" | "FRIDAY_REVIEW") {
  const questions = await effectiveListFor(prisma.checkInQuestion, userId, { category: kind });
  return questions.filter((q) => q.active).sort((a, b) => a.order - b.order);
}

async function ensureSessionForUserSlot(userId: string, slotId: string, today: Date, baseId: string) {
  const existing = await prisma.checkInSession.findFirst({
    where: { userId, slotId, date: today },
  });
  if (existing) return null;

  const session = await prisma.checkInSession.create({
    data: { userId, slotId, date: today, kind: "DAILY", baseId },
  });
  await notifyUser({
    userId,
    type: "CHECKIN_PENDENTE",
    relatedType: "CheckInSession",
    relatedId: session.id,
    message: "Você tem um check-in pendente.",
  });
  return session.id;
}

// Cada usuário tem seu próprio conjunto efetivo de horários (o mesmo horário
// "padrão" pode virar uma cópia pessoal com outro id assim que alguém o
// personaliza — ver lib/services/personalization.ts), então o disparo não
// pode mais partir de "um CheckInSlot global bate com a hora atual, dispara
// pra todo mundo da base": o loop percorre usuário por usuário e resolve os
// horários DELE. `matchTime` filtra pelo horário atual (cron, a cada minuto);
// omitido, dispara todos os horários ativos de cada usuário (botão manual).
async function dispatchSlotSessions(date: Date, matchTime?: string) {
  const today = startOfDay(date);
  const baseId = requireBaseId();
  const userIds = await getActiveUserIdsWithBaseAccess(baseId);

  const created: string[] = [];
  for (const userId of userIds) {
    const slots = await getEffectiveActiveSlotsFor(userId);
    for (const slot of slots) {
      if (matchTime !== undefined && slot.time !== matchTime) continue;
      const sessionId = await ensureSessionForUserSlot(userId, slot.id, today, baseId);
      if (sessionId) created.push(sessionId);
    }
  }
  return created;
}

export async function dispatchDueSlotSessions(nowLabel: string, date: Date = new Date()) {
  return dispatchSlotSessions(date, nowLabel);
}

export async function dispatchAllActiveSlotSessions(date: Date = new Date()) {
  return dispatchSlotSessions(date);
}

// Sem isso, uma sessão de check-in nunca respondida ficava PENDENTE para
// sempre — o único sinal de que ela existia era um alerta que se repetia
// todo dia e podia ser adiado indefinidamente, sem nunca virar um registro
// negativo explícito nem aparecer em métrica nenhuma.
export async function markStaleSessionsAsIgnored(date: Date = new Date()) {
  const today = startOfDay(date);
  const { count } = await prisma.checkInSession.updateMany({
    where: { status: "PENDENTE", date: { lt: today } },
    data: { status: "IGNORADO" },
  });
  return count;
}

export async function ensureWeeklyReviewSessions(
  kind: "MONDAY_REVIEW" | "FRIDAY_REVIEW",
  date: Date = new Date()
) {
  const today = startOfDay(date);
  const baseId = requireBaseId();
  const userIds = await getActiveUserIdsWithBaseAccess(baseId);

  const created: string[] = [];
  for (const userId of userIds) {
    const existing = await prisma.checkInSession.findFirst({
      where: { userId, kind, date: today },
    });
    if (existing) continue;

    const session = await prisma.checkInSession.create({
      data: { userId, date: today, kind, baseId },
    });
    await notifyUser({
      userId,
      type: "CHECKIN_PENDENTE",
      relatedType: "CheckInSession",
      relatedId: session.id,
      message:
        kind === "MONDAY_REVIEW"
          ? "Sua revisão semanal de segunda-feira está pendente."
          : "Sua revisão semanal de sexta-feira está pendente.",
    });
    created.push(session.id);
  }
  return created;
}

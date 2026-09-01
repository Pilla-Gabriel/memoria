import { prisma } from "@/lib/prisma";

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

export async function getQuestionsFor(kind: "DAILY" | "MONDAY_REVIEW" | "FRIDAY_REVIEW") {
  return prisma.checkInQuestion.findMany({
    where: { category: kind, active: true },
    orderBy: { order: "asc" },
  });
}

export async function ensureSessionsForSlot(slotId: string, date: Date = new Date()) {
  const today = startOfDay(date);
  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true } });

  const created: string[] = [];
  for (const user of users) {
    const existing = await prisma.checkInSession.findFirst({
      where: { userId: user.id, slotId, date: today },
    });
    if (existing) continue;

    const session = await prisma.checkInSession.create({
      data: { userId: user.id, slotId, date: today, kind: "DAILY" },
    });
    await prisma.alert.create({
      data: {
        userId: user.id,
        type: "CHECKIN_PENDENTE",
        relatedType: "CheckInSession",
        relatedId: session.id,
        message: "Você tem um check-in pendente.",
      },
    });
    created.push(session.id);
  }
  return created;
}

export async function ensureWeeklyReviewSessions(
  kind: "MONDAY_REVIEW" | "FRIDAY_REVIEW",
  date: Date = new Date()
) {
  const today = startOfDay(date);
  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true } });

  const created: string[] = [];
  for (const user of users) {
    const existing = await prisma.checkInSession.findFirst({
      where: { userId: user.id, kind, date: today },
    });
    if (existing) continue;

    const session = await prisma.checkInSession.create({
      data: { userId: user.id, date: today, kind },
    });
    await prisma.alert.create({
      data: {
        userId: user.id,
        type: "CHECKIN_PENDENTE",
        relatedType: "CheckInSession",
        relatedId: session.id,
        message:
          kind === "MONDAY_REVIEW"
            ? "Sua revisão semanal de segunda-feira está pendente."
            : "Sua revisão semanal de sexta-feira está pendente.",
      },
    });
    created.push(session.id);
  }
  return created;
}

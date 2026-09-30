import { prisma } from "@/lib/prisma";
import { getVisibleUserIds } from "@/lib/rbac";

// Busca o pai (Task/Frente/Goal/CheckInSession) já escopado pela base ativa
// (a extensão do Prisma em lib/prisma.ts filtra isso automaticamente) antes
// de qualquer leitura/escrita num filho seu (comentário, anexo, bloqueio,
// entrega, prorrogação, resposta de check-in). Essas entidades filhas não
// têm baseId próprio — comparar dois ids vindos da própria URL (como
// `blocker.frenteId !== id`) não é validação nenhuma, os dois valores são
// controlados por quem chama. Isolamento delas depende inteiramente de
// sempre passar pelo pai por aqui, nunca resolver o filho direto pelo id.
//
// Chamar SEMPRE antes de qualquer escrita no filho, nunca depois — validar
// depois de já ter escrito não protege nada.

export async function getScopedTask(taskId: string) {
  return prisma.task.findUnique({ where: { id: taskId } });
}

export async function getScopedFrente(frenteId: string) {
  return prisma.frente.findUnique({ where: { id: frenteId } });
}

export async function getScopedGoal(goalId: string) {
  return prisma.goal.findUnique({ where: { id: goalId } });
}

// Além da base, o dono: USER só enxerga as próprias tarefas/metas no GET,
// mas comentar, anexar e prorrogar resolviam o pai só pela base — dava pra
// agir numa tarefa de outra pessoa sabendo o id (achado G-16).
type SessionUser = { id: string; role: string };

async function canSeeOwner(ownerId: string, user: SessionUser) {
  const visible = await getVisibleUserIds(user);
  return !visible || visible.includes(ownerId);
}

export async function getVisibleTask(taskId: string, user: SessionUser) {
  const task = await getScopedTask(taskId);
  return task && (await canSeeOwner(task.ownerId, user)) ? task : null;
}

export async function getVisibleGoal(goalId: string, user: SessionUser) {
  const goal = await getScopedGoal(goalId);
  return goal && (await canSeeOwner(goal.ownerId, user)) ? goal : null;
}

export async function getScopedCheckInSession(sessionId: string) {
  return prisma.checkInSession.findUnique({ where: { id: sessionId } });
}

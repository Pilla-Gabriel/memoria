// Consultas de acesso a base que não dependem de next/headers — por isso
// separadas de lib/active-base.ts. server.ts roda server.ts com tsx puro,
// fora do runtime do Next.js: importar next/headers (mesmo sem chamar
// cookies()) já falha no carregamento do módulo, porque o AsyncLocalStorage
// interno do Next ainda não existe nesse ponto. lib/services/checkin.ts e
// lib/services/weekly-report.ts são usados tanto pelas rotas de API (dentro
// do runtime do Next) quanto pelo cron em server.ts — então não podem
// importar nada que puxe next/headers, direta ou indiretamente.
import { prisma } from "@/lib/prisma";

export type AccessibleBase = {
  id: string;
  slug: string;
  name: string;
  color: string;
};

// ADMIN enxerga todas as bases implicitamente. USER só acessa as bases com
// um UserBase explícito.
export async function getAccessibleBases(user: { id: string; role: string }): Promise<AccessibleBase[]> {
  if (user.role === "ADMIN") {
    return prisma.base.findMany({ orderBy: { name: "asc" } });
  }
  const grants = await prisma.userBase.findMany({
    where: { userId: user.id },
    include: { base: true },
    orderBy: { base: { name: "asc" } },
  });
  return grants.map((g) => g.base);
}

// Ids dos usuários ativos com acesso à base (ADMIN sempre, os demais via
// UserBase) — usado pelos jobs de check-in para não criar sessão numa base
// que o usuário nem consegue ver.
export async function getActiveUserIdsWithBaseAccess(baseId: string): Promise<string[]> {
  const [admins, grants] = await Promise.all([
    prisma.user.findMany({ where: { active: true, role: "ADMIN" }, select: { id: true } }),
    prisma.userBase.findMany({
      where: { baseId, user: { active: true } },
      select: { userId: true },
    }),
  ]);
  return Array.from(new Set([...admins.map((u) => u.id), ...grants.map((g) => g.userId)]));
}

// Base "de casa" do usuário para o que é da PESSOA e não da base (check-in
// diário e revisão semanal): a mais antiga entre as que ele acessa. Os jobs
// rodam uma vez por base e o horário de check-in não tem base — sem isso,
// quem acessa N bases (todo ADMIN) recebia N check-ins e N notificações por
// horário (achado G-12 da auditoria Gengar, 2026-09-25).
export async function getHomeBaseIdsByUser(userIds: string[]): Promise<Map<string, string>> {
  const home = new Map<string, string>();
  if (userIds.length === 0) return home;
  const [users, bases, grants] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, role: true } }),
    prisma.base.findMany({ select: { id: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.userBase.findMany({ where: { userId: { in: userIds } }, select: { userId: true, baseId: true } }),
  ]);
  const order = new Map(bases.map((b, i) => [b.id, i]));
  for (const user of users) {
    if (user.role === "ADMIN") {
      if (bases[0]) home.set(user.id, bases[0].id);
      continue;
    }
    const mine = grants
      .filter((g) => g.userId === user.id && order.has(g.baseId))
      .sort((a, b) => order.get(a.baseId)! - order.get(b.baseId)!);
    if (mine[0]) home.set(user.id, mine[0].baseId);
  }
  return home;
}

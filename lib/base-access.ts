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

// ADMIN enxerga todas as bases implicitamente. LEADER/USER só acessam as
// bases com um UserBase explícito.
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

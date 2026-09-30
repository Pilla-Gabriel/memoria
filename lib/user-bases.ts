import { prisma } from "@/lib/prisma";

// Não havia tela para dar acesso a uma base — só o seed criava UserBase, e
// todo USER cadastrado pelo admin caía em "Nenhuma base disponível"
// (achado G-18 da auditoria Gengar). Troca o conjunto inteiro de bases do
// usuário e devolve os nomes antes/depois para a auditoria.
export async function replaceUserBases(userId: string, baseIds: string[]) {
  const wanted = Array.from(new Set(baseIds));
  const [valid, current] = await Promise.all([
    prisma.base.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } }),
    prisma.userBase.findMany({ where: { userId }, include: { base: { select: { name: true } } } }),
  ]);
  if (valid.length !== wanted.length) return { error: "Uma das bases escolhidas não existe mais." } as const;

  await prisma.$transaction([
    prisma.userBase.deleteMany({ where: { userId } }),
    prisma.userBase.createMany({ data: valid.map((b) => ({ userId, baseId: b.id })) }),
  ]);

  const names = (list: string[]) => list.sort((a, b) => a.localeCompare(b)).join(", ") || "nenhuma";
  return {
    before: names(current.map((g) => g.base.name)),
    after: names(valid.map((b) => b.name)),
  } as const;
}

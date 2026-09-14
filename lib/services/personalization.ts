// Motor genérico de personalização por usuário para os 3 modelos
// "compartilhados entre bases, mas por usuário": CheckInSlot, CheckInQuestion
// e TaskCategory. Nenhum dos três tem baseId (ver comentário em
// lib/prisma.ts) — o mesmo conjunto padrão é visível em qualquer base, mas
// cada usuário pode ter sua própria versão sem afetar os demais.
//
// Convenção comum aos 3 modelos:
// - userId null            -> item padrão, compartilhado, visível por quem
//                             ainda não personalizou aquele item específico.
// - userId = <user>,
//   overridesId null       -> criação própria do usuário (sem relação com
//                             nenhum padrão).
// - userId = <user>,
//   overridesId = <id>     -> cópia pessoal que substitui, só pra esse
//                             usuário, o padrão apontado por overridesId
//                             (criada ao editar ou "excluir" um padrão) —
//                             o padrão original some da lista efetiva desse
//                             usuário, esteja a cópia ativa ou não.
//
// ADMIN é o único que cria/edita o padrão em si (afeta todo mundo que não
// personalizou) e o único que pode "espelhar" um padrão pra todos os
// usuários, descartando as personalizações existentes (mirrorToAllUsers).
// Qualquer outro ator sempre opera sobre a própria cópia pessoal.

type PersonalizableRow = {
  id: string;
  userId: string | null;
  overridesId: string | null;
  active: boolean;
};

type PersonalizableDelegate<Row extends PersonalizableRow> = {
  findMany(args: { where: Record<string, unknown> }): Promise<Row[]>;
  findUnique(args: { where: { id: string } }): Promise<Row | null>;
  findFirst(args: { where: Record<string, unknown> }): Promise<Row | null>;
  create(args: { data: Record<string, unknown> }): Promise<Row>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Row>;
  delete(args: { where: { id: string } }): Promise<Row>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
};

export type Actor = { id: string; role: string };

export type ActionResult<Row> = { ok: true; item: Row } | { ok: false; status: number; error: string };

/**
 * Lista efetiva de um usuário: os padrões que ele não personalizou, mais os
 * itens pessoais dele (criações próprias e cópias que substituem um padrão).
 * `extraWhere` filtra ambos os lados igualmente (ex.: `{ category: "DAILY" }`).
 */
export async function effectiveListFor<Row extends PersonalizableRow>(
  delegate: PersonalizableDelegate<Row>,
  userId: string,
  extraWhere?: Record<string, unknown>
): Promise<Row[]> {
  const [defaults, personal] = await Promise.all([
    delegate.findMany({ where: { userId: null, ...extraWhere } }),
    delegate.findMany({ where: { userId, ...extraWhere } }),
  ]);
  const overriddenDefaultIds = new Set(
    personal.map((p) => p.overridesId).filter((id): id is string => id !== null)
  );
  const visibleDefaults = defaults.filter((d) => !overriddenDefaultIds.has(d.id));
  return [...visibleDefaults, ...personal];
}

/** Só os itens padrão (userId null) — usado pela curadoria do ADMIN em Administração. */
export async function defaultsOnly<Row extends PersonalizableRow>(
  delegate: PersonalizableDelegate<Row>,
  extraWhere?: Record<string, unknown>
): Promise<Row[]> {
  return delegate.findMany({ where: { userId: null, ...extraWhere } });
}

/** ADMIN cria um novo padrão (afeta todo mundo); qualquer outro ator cria um item só seu. */
export async function createItem<Row extends PersonalizableRow>(
  delegate: PersonalizableDelegate<Row>,
  actor: Actor,
  data: Record<string, unknown>
): Promise<Row> {
  const userId = actor.role === "ADMIN" ? null : actor.id;
  return delegate.create({ data: { ...data, userId, overridesId: null } });
}

/**
 * Aplica `data` sobre `targetId`. ADMIN edita o item em si, seja padrão ou de
 * outro usuário. Um ator comum editando seu próprio item edita direto; editando
 * um padrão, cria (ou reaproveita) sua cópia pessoal daquele padrão em vez de
 * tocar na linha compartilhada.
 */
export async function updateOrFork<Row extends PersonalizableRow>(
  delegate: PersonalizableDelegate<Row>,
  actor: Actor,
  targetId: string,
  data: Record<string, unknown>
): Promise<ActionResult<Row>> {
  const target = await delegate.findUnique({ where: { id: targetId } });
  if (!target) return { ok: false, status: 404, error: "Item não encontrado" };

  if (actor.role === "ADMIN" || target.userId === actor.id) {
    const item = await delegate.update({ where: { id: targetId }, data });
    return { ok: true, item };
  }

  if (target.userId !== null) {
    return { ok: false, status: 403, error: "Este item pertence a outro usuário" };
  }

  const existingFork = await delegate.findFirst({ where: { userId: actor.id, overridesId: targetId } });
  if (existingFork) {
    const item = await delegate.update({ where: { id: existingFork.id }, data });
    return { ok: true, item };
  }

  const { id: _id, userId: _userId, overridesId: _overridesId, ...baseFields } = target as unknown as Record<
    string,
    unknown
  >;
  const item = await delegate.create({
    data: { ...baseFields, ...data, userId: actor.id, overridesId: targetId },
  });
  return { ok: true, item };
}

/**
 * "Exclui" `targetId`. Um item pessoal do próprio ator é apagado de verdade
 * (não afeta ninguém). Um padrão, pra um ator comum, nunca é apagado — em vez
 * disso ganha (ou reaproveita) uma cópia pessoal desativada, que passa a
 * esconder aquele padrão só na visão desse usuário. ADMIN apaga o item em si.
 */
export async function deleteOrHide<Row extends PersonalizableRow>(
  delegate: PersonalizableDelegate<Row>,
  actor: Actor,
  targetId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const target = await delegate.findUnique({ where: { id: targetId } });
  if (!target) return { ok: true };

  if (actor.role === "ADMIN" || target.userId === actor.id) {
    await delegate.delete({ where: { id: targetId } });
    return { ok: true };
  }

  if (target.userId !== null) {
    return { ok: false, status: 403, error: "Este item pertence a outro usuário" };
  }

  const existingFork = await delegate.findFirst({ where: { userId: actor.id, overridesId: targetId } });
  if (existingFork) {
    await delegate.update({ where: { id: existingFork.id }, data: { active: false } });
    return { ok: true };
  }

  const { id: _id, userId: _userId, overridesId: _overridesId, ...baseFields } = target as unknown as Record<
    string,
    unknown
  >;
  await delegate.create({ data: { ...baseFields, active: false, userId: actor.id, overridesId: targetId } });
  return { ok: true };
}

/**
 * ADMIN-only: descarta toda personalização que qualquer usuário tenha feito
 * em cima do padrão `targetId`, revertendo todo mundo pra ver o padrão atual
 * (útil depois de editar um padrão e querer que a mudança valha pra quem já
 * tinha uma cópia pessoal daquele item).
 */
export async function mirrorToAllUsers<Row extends PersonalizableRow>(
  delegate: PersonalizableDelegate<Row>,
  targetId: string
): Promise<{ ok: true; count: number } | { ok: false; status: number; error: string }> {
  const target = await delegate.findUnique({ where: { id: targetId } });
  if (!target) return { ok: false, status: 404, error: "Item não encontrado" };
  if (target.userId !== null) {
    return { ok: false, status: 400, error: "Só é possível espelhar um item padrão" };
  }
  const { count } = await delegate.deleteMany({ where: { overridesId: targetId } });
  return { ok: true, count };
}

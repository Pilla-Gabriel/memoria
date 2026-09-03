import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withBase } from "@/lib/with-base";
import { getScopedFrente } from "@/lib/base-guards";

const schema = z.object({ status: z.enum(["ABERTO", "RESOLVIDO"]) });

export const PATCH = withBase<{ params: Promise<{ id: string; blockerId: string }> }>(async (request, ctx, session) => {
  const { id, blockerId } = await ctx.params;

  // Valida o pai (Frente) escopado pela base ativa ANTES de tocar no
  // bloqueio — Blocker não tem baseId próprio, e comparar
  // `blocker.frenteId !== id` não é validação (os dois vêm da própria URL).
  const frente = await getScopedFrente(id);
  if (!frente) return NextResponse.json({ error: "Frente não encontrada" }, { status: 404 });

  const blocker = await prisma.blocker.findUnique({ where: { id: blockerId } });
  if (!blocker || blocker.frenteId !== frente.id) {
    return NextResponse.json({ error: "Bloqueio não encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const updated = await prisma.blocker.update({
    where: { id: blockerId },
    data: {
      status: parsed.data.status,
      resolvedAt: parsed.data.status === "RESOLVIDO" ? new Date() : null,
    },
  });

  await logAudit({
    entityType: "Frente",
    entityId: id,
    action: parsed.data.status === "RESOLVIDO" ? "BLOQUEIO_RESOLVIDO" : "BLOQUEIO_REABERTO",
    userId: session.user.id,
  });

  return NextResponse.json({ blocker: updated });
});

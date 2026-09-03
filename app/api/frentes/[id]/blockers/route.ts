import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blockerCreateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { withBase } from "@/lib/with-base";
import { getScopedFrente } from "@/lib/base-guards";

export const POST = withBase<{ params: Promise<{ id: string }> }>(async (request, ctx, session, baseId) => {
  const { id } = await ctx.params;
  const frente = await getScopedFrente(id);
  if (!frente) return NextResponse.json({ error: "Frente não encontrada" }, { status: 404 });

  const body = await request.json();
  const parsed = blockerCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const blocker = await prisma.blocker.create({
    data: {
      frenteId: id,
      description: parsed.data.description,
      impact: parsed.data.impact,
      ownerToUnblockId: parsed.data.ownerToUnblockId || null,
      ownerToUnblockName: parsed.data.ownerToUnblockName || null,
      createdById: session.user.id,
    },
    include: { ownerToUnblock: { select: { name: true } }, createdBy: { select: { name: true } } },
  });

  await logAudit({
    entityType: "Frente",
    entityId: id,
    action: "BLOQUEIO_REGISTRADO",
    newValue: parsed.data.description,
    userId: session.user.id,
  });

  if (blocker.ownerToUnblockId) {
    await prisma.alert.create({
      data: {
        userId: blocker.ownerToUnblockId,
        type: "BLOQUEIO_ABERTO",
        relatedType: "Frente",
        relatedId: id,
        message: `Você foi apontado como responsável por destravar: "${blocker.description}" (frente "${frente.name}").`,
        baseId,
      },
    });
  }

  return NextResponse.json({ blocker });
});

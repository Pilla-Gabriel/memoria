import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deliveryCreateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { withBase } from "@/lib/with-base";
import { getScopedFrente } from "@/lib/base-guards";

export const POST = withBase<{ params: Promise<{ id: string }> }>(async (request, ctx, session) => {
  const { id } = await ctx.params;
  const frente = await getScopedFrente(id);
  if (!frente) return NextResponse.json({ error: "Frente não encontrada" }, { status: 404 });

  const body = await request.json();
  const parsed = deliveryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const delivery = await prisma.delivery.create({
    data: {
      frenteId: id,
      title: parsed.data.title,
      evidence: parsed.data.evidence,
      taskId: parsed.data.taskId || null,
      deliveredById: session.user.id,
    },
    include: { deliveredBy: { select: { name: true } } },
  });

  await logAudit({
    entityType: "Frente",
    entityId: id,
    action: "ENTREGA_REGISTRADA",
    newValue: parsed.data.title,
    userId: session.user.id,
  });

  return NextResponse.json({ delivery });
});

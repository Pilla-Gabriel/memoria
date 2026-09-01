import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deliveryCreateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const frente = await prisma.frente.findUnique({ where: { id } });
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
}

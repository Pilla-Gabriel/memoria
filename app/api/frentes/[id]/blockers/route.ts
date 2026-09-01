import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { blockerCreateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const frente = await prisma.frente.findUnique({ where: { id } });
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
      },
    });
  }

  return NextResponse.json({ blocker });
}

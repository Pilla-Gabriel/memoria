import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const schema = z.object({ status: z.enum(["ABERTO", "RESOLVIDO"]) });

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string; blockerId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id, blockerId } = await ctx.params;
  const blocker = await prisma.blocker.findUnique({ where: { id: blockerId } });
  if (!blocker || blocker.frenteId !== id) {
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
}

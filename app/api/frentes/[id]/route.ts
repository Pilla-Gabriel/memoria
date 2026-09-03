import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/rbac";
import { frenteUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { computeFrenteComparison } from "@/lib/services/frentes";
import { withBase } from "@/lib/with-base";

export const GET = withBase<{ params: Promise<{ id: string }> }>(async (_request, ctx) => {
  const { id } = await ctx.params;
  const frente = await prisma.frente.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      snapshots: { include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 },
      deliveries: { include: { deliveredBy: { select: { name: true } } }, orderBy: { deliveredAt: "desc" } },
      blockers: {
        include: { ownerToUnblock: { select: { name: true } }, createdBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!frente) return NextResponse.json({ error: "Frente não encontrada" }, { status: 404 });

  const comparison = await computeFrenteComparison(id, new Date(0));

  return NextResponse.json({ frente, comparison });
});

export const PATCH = withBase<{ params: Promise<{ id: string }> }>(async (request, ctx, session) => {
  if (!isManager(session.user.role)) {
    return NextResponse.json({ error: "Apenas líderes ou administradores podem editar frentes" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.frente.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Frente não encontrada" }, { status: 404 });

  const body = await request.json();
  const parsed = frenteUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { targetDate, ...rest } = parsed.data;
  const frente = await prisma.frente.update({
    where: { id },
    data: { ...rest, ...(targetDate ? { targetDate: new Date(targetDate) } : {}) },
  });

  await logAudit({ entityType: "Frente", entityId: id, action: "ATUALIZADA", userId: session.user.id });

  return NextResponse.json({ frente });
});

export const DELETE = withBase<{ params: Promise<{ id: string }> }>(async (_request, ctx, session) => {
  if (!isManager(session.user.role)) {
    return NextResponse.json({ error: "Apenas líderes ou administradores podem arquivar frentes" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.frente.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Frente não encontrada" }, { status: 404 });

  await prisma.frente.update({ where: { id }, data: { active: false } });
  await logAudit({ entityType: "Frente", entityId: id, action: "ARQUIVADA", userId: session.user.id });

  return NextResponse.json({ ok: true });
});

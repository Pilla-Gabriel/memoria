import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVisibleUserIds } from "@/lib/rbac";
import { goalUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { withBase } from "@/lib/with-base";

async function assertVisible(ownerId: string, sessionUser: { id: string; role: string }) {
  const visible = await getVisibleUserIds(sessionUser);
  return !visible || visible.includes(ownerId);
}

export const GET = withBase<{ params: Promise<{ id: string }> }>(async (_request, ctx, session) => {
  const { id } = await ctx.params;
  const goal = await prisma.goal.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      progress: { include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!goal || !(await assertVisible(goal.ownerId, session.user))) {
    return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ goal });
});

export const PATCH = withBase<{ params: Promise<{ id: string }> }>(async (request, ctx, session) => {
  const { id } = await ctx.params;
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || !(await assertVisible(goal.ownerId, session.user))) {
    return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = goalUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = { ...data };
  delete updateData.startDate;
  delete updateData.dueDate;
  delete updateData.unitType;
  delete updateData.unitLabel;

  if (data.startDate) updateData.startDate = new Date(data.startDate);
  if (data.dueDate) updateData.dueDate = new Date(data.dueDate);

  const unitType = data.unitType ?? goal.unitType;
  if (data.unitType || data.unitLabel !== undefined) {
    const unitLabel = unitType === "NUMBER" ? (data.unitLabel ?? goal.unitLabel ?? goal.unit) : null;
    updateData.unitType = unitType;
    updateData.unitLabel = unitLabel;
    updateData.unit = unitType === "PERCENTAGE" ? "%" : unitLabel;
  }

  const updated = await prisma.goal.update({ where: { id }, data: updateData });

  await logAudit({ entityType: "Goal", entityId: id, action: "ATUALIZADA", userId: session.user.id });

  return NextResponse.json({ goal: updated });
});

export const DELETE = withBase<{ params: Promise<{ id: string }> }>(async (_request, ctx, session) => {
  const { id } = await ctx.params;
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || !(await assertVisible(goal.ownerId, session.user))) {
    return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });
  }

  await logAudit({ entityType: "Goal", entityId: id, action: "EXCLUIDA", newValue: goal.title, userId: session.user.id });

  await prisma.$transaction([
    prisma.goalProgress.deleteMany({ where: { goalId: id } }),
    prisma.goal.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
});

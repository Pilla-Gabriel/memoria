import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { goalProgressUpdateSchema } from "@/lib/validation";
import { evaluateGoalStatus } from "@/lib/services/risk-engine";
import { logAudit } from "@/lib/audit";

async function recomputeCurrentValue(goalId: string, excludeId?: string) {
  const latest = await prisma.goalProgress.findFirst({
    where: { goalId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return latest?.value ?? 0;
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string; progressId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id, progressId } = await ctx.params;
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });

  const entry = await prisma.goalProgress.findUnique({ where: { id: progressId } });
  if (!entry || entry.goalId !== id) {
    return NextResponse.json({ error: "Registro de avanço não encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = goalProgressUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  await prisma.goalProgress.update({
    where: { id: progressId },
    data: { value: parsed.data.value, note: parsed.data.note ?? null },
  });

  const currentValue = await recomputeCurrentValue(id);
  const nextStatus = evaluateGoalStatus({
    status: goal.status,
    dueDate: goal.dueDate,
    currentValue,
    targetValue: goal.targetValue,
  });

  const updated = await prisma.goal.update({
    where: { id },
    data: { currentValue, status: nextStatus },
  });

  await logAudit({
    entityType: "Goal",
    entityId: id,
    action: "AVANCO_EDITADO",
    userId: session.user.id,
  });

  return NextResponse.json({ goal: updated });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string; progressId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id, progressId } = await ctx.params;
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });

  const entry = await prisma.goalProgress.findUnique({ where: { id: progressId } });
  if (!entry || entry.goalId !== id) {
    return NextResponse.json({ error: "Registro de avanço não encontrado" }, { status: 404 });
  }

  await prisma.goalProgress.delete({ where: { id: progressId } });

  const currentValue = await recomputeCurrentValue(id);
  const nextStatus = evaluateGoalStatus({
    status: goal.status,
    dueDate: goal.dueDate,
    currentValue,
    targetValue: goal.targetValue,
  });

  const updated = await prisma.goal.update({
    where: { id },
    data: { currentValue, status: nextStatus },
  });

  await logAudit({
    entityType: "Goal",
    entityId: id,
    action: "AVANCO_EXCLUIDO",
    userId: session.user.id,
  });

  return NextResponse.json({ goal: updated });
}

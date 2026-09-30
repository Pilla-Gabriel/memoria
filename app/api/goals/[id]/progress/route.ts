import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { goalProgressSchema } from "@/lib/validation";
import { evaluateGoalStatus } from "@/lib/services/risk-engine";
import { logAudit } from "@/lib/audit";
import { withBase } from "@/lib/with-base";
import { getVisibleGoal } from "@/lib/base-guards";
import { validationErrorResponse } from "@/lib/api-errors";

export const POST = withBase<{ params: Promise<{ id: string }> }>(async (request, ctx, session) => {
  const { id } = await ctx.params;
  const goal = await getVisibleGoal(id, session.user);
  if (!goal) return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });

  const body = await request.json();
  const parsed = goalProgressSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  await prisma.goalProgress.create({
    data: {
      goalId: id,
      value: parsed.data.value,
      note: parsed.data.note ?? null,
      createdById: session.user.id,
    },
  });

  const newCurrentValue = parsed.data.value;
  const nextStatus = evaluateGoalStatus({
    status: goal.status,
    dueDate: goal.dueDate,
    currentValue: newCurrentValue,
    targetValue: goal.targetValue,
  });

  const updated = await prisma.goal.update({
    where: { id },
    data: { currentValue: newCurrentValue, status: nextStatus },
  });

  if (nextStatus !== goal.status) {
    await logAudit({
      entityType: "Goal",
      entityId: id,
      action: "STATUS_ATUALIZADO",
      field: "status",
      oldValue: goal.status,
      newValue: nextStatus,
      userId: session.user.id,
    });
  }

  return NextResponse.json({ goal: updated });
});

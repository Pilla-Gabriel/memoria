import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extensionRequestSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { withBase } from "@/lib/with-base";
import { requireBaseId } from "@/lib/base-context";

async function notifyApprover(task: { id: string; title: string; ownerId: string }) {
  const owner = await prisma.user.findUnique({ where: { id: task.ownerId }, select: { leaderId: true } });
  const approver = owner?.leaderId
    ? await prisma.user.findUnique({ where: { id: owner.leaderId }, select: { id: true } })
    : await prisma.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!approver) return;

  await prisma.alert.create({
    data: {
      userId: approver.id,
      type: "PRORROGACAO_PENDENTE",
      relatedType: "Task",
      relatedId: task.id,
      message: `A tarefa "${task.title}" tem uma prorrogação aguardando sua aprovação.`,
      baseId: requireBaseId(),
    },
  });
}

export const POST = withBase<{ params: Promise<{ id: string }> }>(async (request, ctx, session) => {
  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  if (!task.dueDate) {
    return NextResponse.json({ error: "Defina um prazo antes de solicitar prorrogação" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = extensionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const withinLimit = task.extensionsUsed < task.maxExtensions;

  const extension = await prisma.taskExtensionRequest.create({
    data: {
      taskId: id,
      requestedById: session.user.id,
      previousDueDate: task.dueDate,
      newDueDate: new Date(parsed.data.newDueDate),
      justification: parsed.data.justification,
      status: withinLimit ? "AUTO_APROVADA" : "PENDENTE_APROVACAO",
      resolvedAt: withinLimit ? new Date() : null,
    },
  });

  if (withinLimit) {
    await prisma.task.update({
      where: { id },
      data: {
        dueDate: extension.newDueDate,
        extensionsUsed: { increment: 1 },
        status: task.status === "ATRASADA" ? "EM_ANDAMENTO" : task.status,
      },
    });
  } else {
    await notifyApprover(task);
  }

  await logAudit({
    entityType: "Task",
    entityId: id,
    action: withinLimit ? "PRORROGACAO_AUTO_APROVADA" : "PRORROGACAO_SOLICITADA",
    field: "dueDate",
    oldValue: task.dueDate.toISOString(),
    newValue: extension.newDueDate.toISOString(),
    userId: session.user.id,
  });

  return NextResponse.json({ extension, autoApproved: withinLimit });
});

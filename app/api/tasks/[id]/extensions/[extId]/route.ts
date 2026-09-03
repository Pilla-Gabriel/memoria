import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { withBase } from "@/lib/with-base";
import { getScopedTask } from "@/lib/base-guards";

const schema = z.object({ decision: z.enum(["APROVADA", "REJEITADA"]) });

export const PATCH = withBase<{ params: Promise<{ id: string; extId: string }> }>(async (request, ctx, session) => {
  if (!isManager(session.user.role)) {
    return NextResponse.json({ error: "Apenas líderes ou administradores podem aprovar prorrogações" }, { status: 403 });
  }

  const { id, extId } = await ctx.params;

  // Valida o pai (Task) escopado pela base ativa ANTES de tocar na
  // prorrogação — TaskExtensionRequest não tem baseId próprio, então
  // validar depois de já ter escrito não protegeria nada.
  const task = await getScopedTask(id);
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const extension = await prisma.taskExtensionRequest.findUnique({ where: { id: extId } });
  if (!extension || extension.taskId !== task.id || extension.status !== "PENDENTE_APROVACAO") {
    return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Decisão inválida" }, { status: 400 });

  const updated = await prisma.taskExtensionRequest.update({
    where: { id: extId },
    data: { status: parsed.data.decision, approvedById: session.user.id, resolvedAt: new Date() },
  });

  if (parsed.data.decision === "APROVADA") {
    await prisma.task.update({
      where: { id },
      data: {
        dueDate: updated.newDueDate,
        extensionsUsed: { increment: 1 },
        status: task.status === "ATRASADA" ? "EM_ANDAMENTO" : task.status,
      },
    });
  }

  await logAudit({
    entityType: "Task",
    entityId: id,
    action: `PRORROGACAO_${parsed.data.decision}`,
    userId: session.user.id,
  });

  return NextResponse.json({ extension: updated });
});

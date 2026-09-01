import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const schema = z.object({ decision: z.enum(["APROVADA", "REJEITADA"]) });

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string; extId: string }> }) {
  const session = await auth();
  if (!session?.user || !isManager(session.user.role)) {
    return NextResponse.json({ error: "Apenas líderes ou administradores podem aprovar prorrogações" }, { status: 403 });
  }

  const { id, extId } = await ctx.params;
  const extension = await prisma.taskExtensionRequest.findUnique({ where: { id: extId } });
  if (!extension || extension.taskId !== id || extension.status !== "PENDENTE_APROVACAO") {
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
    const task = await prisma.task.findUniqueOrThrow({ where: { id } });
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
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVisibleUserIds } from "@/lib/rbac";
import { taskUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { formatTaskCode } from "@/lib/services/task-code";
import { withBase } from "@/lib/with-base";

async function assertVisible(userId: string, sessionUser: { id: string; role: string }) {
  const visible = await getVisibleUserIds(sessionUser);
  return !visible || visible.includes(userId);
}

export const GET = withBase<{ params: Promise<{ id: string }> }>(async (_request, ctx, session) => {
  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      code: true,
      comments: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      attachments: { include: { uploadedBy: { select: { id: true, name: true } } } },
      extensionRequests: {
        include: {
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!task || !(await assertVisible(task.ownerId, session.user))) {
    return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  }

  const auditLog = await prisma.auditLog.findMany({
    where: { entityType: "Task", entityId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const displayCode = task.code ? formatTaskCode(task.code.id) : null;

  return NextResponse.json({ task: { ...task, displayCode }, auditLog });
});

export const PATCH = withBase<{ params: Promise<{ id: string }> }>(async (request, ctx, session) => {
  const { id } = await ctx.params;
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || !(await assertVisible(existing.ownerId, session.user))) {
    return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = { ...data };

  if ("dueDate" in data) {
    updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    updateData.needsDueDate = !data.dueDate;
  }
  if (data.status === "CONCLUIDA" && existing.status !== "CONCLUIDA") {
    updateData.completedAt = new Date();
  }

  const task = await prisma.task.update({ where: { id }, data: updateData });

  if (data.status && data.status !== existing.status) {
    await logAudit({
      entityType: "Task",
      entityId: id,
      action: "STATUS_ALTERADO",
      field: "status",
      oldValue: existing.status,
      newValue: data.status,
      userId: session.user.id,
    });
  } else {
    await logAudit({ entityType: "Task", entityId: id, action: "ATUALIZADA", userId: session.user.id });
  }

  return NextResponse.json({ task });
});

export const DELETE = withBase<{ params: Promise<{ id: string }> }>(async (_request, ctx, session) => {
  const { id } = await ctx.params;
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || !(await assertVisible(existing.ownerId, session.user))) {
    return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  }

  await logAudit({ entityType: "Task", entityId: id, action: "EXCLUIDA", newValue: existing.title, userId: session.user.id });

  await prisma.$transaction([
    prisma.taskComment.deleteMany({ where: { taskId: id } }),
    prisma.taskAttachment.deleteMany({ where: { taskId: id } }),
    prisma.taskExtensionRequest.deleteMany({ where: { taskId: id } }),
    prisma.taskCode.deleteMany({ where: { taskId: id } }),
    prisma.task.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
});

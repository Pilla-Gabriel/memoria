import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVisibleUserIds } from "@/lib/rbac";
import { taskCreateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { formatTaskCode } from "@/lib/services/task-code";
import { withBase } from "@/lib/with-base";

function parseMulti(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const items = value.split(",").filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export const GET = withBase(async (request, _ctx, session) => {
  const { searchParams } = new URL(request.url);
  const status = parseMulti(searchParams.get("status"));
  const priority = parseMulti(searchParams.get("priority"));
  const category = parseMulti(searchParams.get("category"));
  const origin = parseMulti(searchParams.get("origin"));
  const scope = searchParams.get("scope") ?? "mine";
  const semPrazo = searchParams.get("semPrazo") === "true";

  const visibleIds = await getVisibleUserIds(session.user);
  const ownerFilter =
    scope === "team" && visibleIds ? { in: visibleIds } : scope === "team" ? undefined : session.user.id;

  const tasks = await prisma.task.findMany({
    where: {
      ownerId: ownerFilter ?? undefined,
      status: status ? { in: status as never[] } : undefined,
      priority: priority ? { in: priority as never[] } : undefined,
      origin: origin ? { in: origin as never[] } : undefined,
      category: category ? { in: category } : undefined,
      ...(semPrazo ? { needsDueDate: true, dueDate: null } : {}),
    },
    include: { owner: { select: { id: true, name: true } }, code: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  const withCode = tasks.map((t) => ({ ...t, displayCode: t.code ? formatTaskCode(t.code.id) : null }));

  return NextResponse.json({ tasks: withCode });
});

export const POST = withBase(async (request, _ctx, session, baseId) => {
  const body = await request.json();
  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const data = parsed.data;
  const ownerId = data.ownerId ?? session.user.id;

  if (ownerId !== session.user.id) {
    const visibleIds = await getVisibleUserIds(session.user);
    if (visibleIds && !visibleIds.includes(ownerId)) {
      return NextResponse.json({ error: "Você não pode atribuir tarefas a este usuário" }, { status: 403 });
    }
  }

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      needsDueDate: !data.dueDate,
      priority: data.priority,
      category: data.category ?? null,
      origin: data.origin,
      ownerId,
      createdById: session.user.id,
      baseId,
    },
  });

  const code = await prisma.taskCode.create({ data: { taskId: task.id } });

  await logAudit({ entityType: "Task", entityId: task.id, action: "CRIADA", userId: session.user.id });

  return NextResponse.json({ task: { ...task, displayCode: formatTaskCode(code.id) } });
});

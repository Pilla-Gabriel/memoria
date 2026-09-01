import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleUserIds } from "@/lib/rbac";
import { goalCreateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "mine";
  const visibleIds = await getVisibleUserIds(session.user);

  const goals = await prisma.goal.findMany({
    where: {
      ownerId: scope === "team" ? (visibleIds ? { in: visibleIds } : undefined) : session.user.id,
    },
    include: { owner: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json({ goals });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const parsed = goalCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const data = parsed.data;
  const ownerId = data.ownerId ?? session.user.id;

  if (ownerId !== session.user.id) {
    const visibleIds = await getVisibleUserIds(session.user);
    if (visibleIds && !visibleIds.includes(ownerId)) {
      return NextResponse.json({ error: "Você não pode criar metas para este usuário" }, { status: 403 });
    }
  }

  const unit = data.unitType === "PERCENTAGE" ? "%" : data.unitLabel!.trim();

  const goal = await prisma.goal.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      indicator: data.indicator,
      targetValue: data.targetValue,
      unit,
      unitType: data.unitType,
      unitLabel: data.unitType === "NUMBER" ? unit : null,
      startDate: new Date(data.startDate),
      dueDate: new Date(data.dueDate),
      successCriteria: data.successCriteria,
      ownerId,
    },
  });

  await logAudit({ entityType: "Goal", entityId: goal.id, action: "CRIADA", userId: session.user.id });

  return NextResponse.json({ goal });
}

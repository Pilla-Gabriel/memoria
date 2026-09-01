import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/rbac";
import { frenteCreateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { evaluateFrenteRisk } from "@/lib/services/frentes";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const frentes = await prisma.frente.findMany({
    where: { active: true },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { deliveries: true, blockers: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const withRisk = frentes.map((f) => ({ ...f, isAtRisk: evaluateFrenteRisk(f) }));

  return NextResponse.json({ frentes: withRisk });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !isManager(session.user.role)) {
    return NextResponse.json({ error: "Apenas líderes ou administradores podem criar frentes" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = frenteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const data = parsed.data;
  const frente = await prisma.frente.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      indicator: data.indicator,
      unit: data.unit,
      baselineValue: data.baselineValue,
      currentValue: data.baselineValue,
      targetValue: data.targetValue,
      targetDate: new Date(data.targetDate),
      source: data.source,
      sourceDetail: data.sourceDetail ?? null,
      ownerId: data.ownerId ?? session.user.id,
    },
  });

  await logAudit({ entityType: "Frente", entityId: frente.id, action: "CRIADA", userId: session.user.id });

  return NextResponse.json({ frente });
}

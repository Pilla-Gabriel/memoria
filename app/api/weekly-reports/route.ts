import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withBase } from "@/lib/with-base";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mondayOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

const createSchema = z.object({
  kind: z.enum(["SEGUNDA", "SEXTA"]),
});

export const GET = withBase(async (request, _ctx, session) => {
  const reports = await prisma.weeklyReport.findMany({
    where: { createdById: session.user.id },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { weekStart: "desc" },
    take: 30,
  });

  return NextResponse.json({ reports });
});

export const POST = withBase(async (request, _ctx, session, baseId) => {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const weekStart = mondayOfWeek(new Date());

  const existing = await prisma.weeklyReport.findFirst({
    where: { createdById: session.user.id, kind: parsed.data.kind, weekStart },
  });
  if (existing) return NextResponse.json({ report: existing });

  const report = await prisma.weeklyReport.create({
    data: { createdById: session.user.id, kind: parsed.data.kind, weekStart, baseId },
  });

  await logAudit({ entityType: "WeeklyReport", entityId: report.id, action: "CRIADO", userId: session.user.id });

  return NextResponse.json({ report });
});

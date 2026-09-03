import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVisibleUserIds } from "@/lib/rbac";
import { weeklyReportUpdateSchema } from "@/lib/validation";
import { buildWeeklyReportData } from "@/lib/services/weekly-report";
import { threeLineSummary } from "@/lib/services/frentes";
import { logAudit } from "@/lib/audit";
import { withBase } from "@/lib/with-base";

async function assertVisible(createdById: string, sessionUser: { id: string; role: string }) {
  const visible = await getVisibleUserIds(sessionUser);
  return !visible || visible.includes(createdById);
}

export const GET = withBase<{ params: Promise<{ id: string }> }>(async (_request, ctx, session) => {
  const { id } = await ctx.params;
  const { report, windowStart, comparisons } = await buildWeeklyReportData(id);

  if (!(await assertVisible(report.createdById, session.user))) {
    return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
  }

  const frentes = comparisons.map((c) => ({ ...c, summary: threeLineSummary(c) }));

  return NextResponse.json({ report, windowStart, frentes });
});

export const PATCH = withBase<{ params: Promise<{ id: string }> }>(async (request, ctx, session) => {
  const { id } = await ctx.params;
  const existing = await prisma.weeklyReport.findUnique({ where: { id } });
  if (!existing || !(await assertVisible(existing.createdById, session.user))) {
    return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = weeklyReportUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const data = { ...parsed.data } as typeof parsed.data & { publishedAt?: Date };
  if (parsed.data.status === "PUBLICADO" && existing.status !== "PUBLICADO") {
    data.publishedAt = new Date();
  }

  const report = await prisma.weeklyReport.update({ where: { id }, data });

  await logAudit({
    entityType: "WeeklyReport",
    entityId: id,
    action: parsed.data.status === "PUBLICADO" ? "PUBLICADO" : "ATUALIZADO",
    userId: session.user.id,
  });

  return NextResponse.json({ report });
});

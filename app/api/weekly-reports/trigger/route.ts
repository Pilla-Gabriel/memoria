import { NextResponse } from "next/server";
import { ensureWeeklyReportDrafts } from "@/lib/services/weekly-report";
import { withBase } from "@/lib/with-base";

export const POST = withBase(async (_request, _ctx, session) => {
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem disparar manualmente" }, { status: 403 });
  }

  const weekday = new Date().getDay();
  const kind = weekday === 5 ? "SEXTA" : "SEGUNDA";
  const created = await ensureWeeklyReportDrafts(kind);

  return NextResponse.json({ created, kind });
});

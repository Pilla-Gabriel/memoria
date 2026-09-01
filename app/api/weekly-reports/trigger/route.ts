import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureWeeklyReportDrafts } from "@/lib/services/weekly-report";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem disparar manualmente" }, { status: 403 });
  }

  const weekday = new Date().getDay();
  const kind = weekday === 5 ? "SEXTA" : "SEGUNDA";
  const created = await ensureWeeklyReportDrafts(kind);

  return NextResponse.json({ created, kind });
}

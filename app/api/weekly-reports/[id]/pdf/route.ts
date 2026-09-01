import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getVisibleUserIds } from "@/lib/rbac";
import { buildWeeklyReportData } from "@/lib/services/weekly-report";
import { generateWeeklyReportPdf } from "@/lib/services/weekly-report-pdf";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const data = await buildWeeklyReportData(id);

  const visibleIds = await getVisibleUserIds(session.user);
  if (visibleIds && !visibleIds.includes(data.report.createdById)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const pdfBytes = await generateWeeklyReportPdf(data);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="entrega-semanal-${id}.pdf"`,
    },
  });
}

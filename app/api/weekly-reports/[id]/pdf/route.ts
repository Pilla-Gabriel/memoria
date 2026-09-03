import { NextResponse } from "next/server";
import { getVisibleUserIds } from "@/lib/rbac";
import { buildWeeklyReportData } from "@/lib/services/weekly-report";
import { generateWeeklyReportPdf } from "@/lib/services/weekly-report-pdf";
import { withBase } from "@/lib/with-base";

export const GET = withBase<{ params: Promise<{ id: string }> }>(async (_request, ctx, session) => {
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
});

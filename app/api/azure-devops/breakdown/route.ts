import { NextResponse } from "next/server";
import { getWorkItemBreakdown, isAzureDevOpsConfigured } from "@/lib/services/azure-devops";
import { withBase } from "@/lib/with-base";

export const GET = withBase(async () => {
  if (!(await isAzureDevOpsConfigured())) {
    return NextResponse.json({ error: "Integração com Azure DevOps não configurada." }, { status: 400 });
  }

  try {
    const breakdown = await getWorkItemBreakdown();
    return NextResponse.json(breakdown);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao consultar Azure DevOps" },
      { status: 502 }
    );
  }
});

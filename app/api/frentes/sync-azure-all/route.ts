import { NextResponse } from "next/server";
import { isAzureDevOpsConfigured } from "@/lib/services/azure-devops";
import { syncAllAzureFrentes } from "@/lib/services/frentes";
import { withBase } from "@/lib/with-base";

export const POST = withBase(async (_request, _ctx, session) => {
  if (!(await isAzureDevOpsConfigured())) {
    return NextResponse.json({ error: "Integração com Azure DevOps não configurada." }, { status: 400 });
  }

  const results = await syncAllAzureFrentes(session.user.id);

  return NextResponse.json({ results });
});

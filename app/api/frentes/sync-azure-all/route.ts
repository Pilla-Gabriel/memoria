import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAzureDevOpsConfigured } from "@/lib/services/azure-devops";
import { syncAllAzureFrentes } from "@/lib/services/frentes";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!isAzureDevOpsConfigured()) {
    return NextResponse.json({ error: "Integração com Azure DevOps não configurada." }, { status: 400 });
  }

  const results = await syncAllAzureFrentes(session.user.id);

  return NextResponse.json({ results });
}

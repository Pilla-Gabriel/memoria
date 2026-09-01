import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkItemBreakdown, isAzureDevOpsConfigured } from "@/lib/services/azure-devops";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!isAzureDevOpsConfigured()) {
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
}

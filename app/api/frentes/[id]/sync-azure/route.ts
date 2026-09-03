import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { syncBacklogCompletion, isAzureDevOpsConfigured } from "@/lib/services/azure-devops";
import { withBase } from "@/lib/with-base";
import { getScopedFrente } from "@/lib/base-guards";

export const POST = withBase<{ params: Promise<{ id: string }> }>(async (_request, ctx, session) => {
  if (!(await isAzureDevOpsConfigured())) {
    return NextResponse.json({ error: "Integração com Azure DevOps não configurada." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const frente = await getScopedFrente(id);
  if (!frente) return NextResponse.json({ error: "Frente não encontrada" }, { status: 404 });

  if (frente.source !== "AZURE_DEVOPS" || !frente.azureWorkItemTypes) {
    return NextResponse.json(
      { error: "Esta frente não está configurada para sincronização automática com Azure DevOps." },
      { status: 400 }
    );
  }

  let result;
  try {
    result = await syncBacklogCompletion(frente.azureWorkItemTypes);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao consultar Azure DevOps" }, { status: 502 });
  }

  const value = frente.unit === "%" ? result.percent : result.done;

  await prisma.frenteSnapshot.create({
    data: {
      frenteId: id,
      value,
      note: `Sincronizado via Azure DevOps: ${result.done}/${result.total} itens concluídos (${result.types.join(", ")}).`,
      createdById: session.user.id,
    },
  });

  const updated = await prisma.frente.update({ where: { id }, data: { currentValue: value } });

  await logAudit({
    entityType: "Frente",
    entityId: id,
    action: "SINCRONIZADO_AZURE_DEVOPS",
    field: "currentValue",
    oldValue: String(frente.currentValue),
    newValue: String(value),
    userId: session.user.id,
  });

  return NextResponse.json({ frente: updated, result });
});

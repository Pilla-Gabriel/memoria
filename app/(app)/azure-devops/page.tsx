import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveBaseId } from "@/lib/active-base";
import { AzureSprintBreakdown } from "@/components/entrega-semanal/azure-sprint-breakdown";

export default async function AzureDevOpsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const baseId = await getActiveBaseId(session.user);
  if (!baseId) redirect("/selecionar-base");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Azure DevOps</h1>
        <p style={{ color: "var(--color-text-secondary)" }}>
          Work items da sprint atual por usuário — horas estimadas, realizadas, Effort e demais campos do processo.
        </p>
      </div>

      <AzureSprintBreakdown />
    </div>
  );
}

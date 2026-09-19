import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { auth } from "@/auth";
import { getActiveBaseId } from "@/lib/active-base";

// Recharts é a maior dependência client-side do bundle — carregada sob
// demanda em vez de estática (ssr:false não é permitido em Server Component).
const AzureSprintBreakdown = dynamic(() =>
  import("@/components/entrega-semanal/azure-sprint-breakdown").then((m) => m.AzureSprintBreakdown)
);

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

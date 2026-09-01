import Link from "next/link";
import { Send, AlertTriangle, Lock, RefreshCw } from "lucide-react";
import { getEntregaSemanalSummary } from "@/lib/services/frentes";
import { isAzureDevOpsConfigured } from "@/lib/services/azure-devops";
import { AzureSyncButton } from "@/components/entrega-semanal/azure-sync-button";

export async function EntregaSemanalSummaryPanel() {
  const summary = await getEntregaSemanalSummary();
  const azureEnv = isAzureDevOpsConfigured();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Link href="/entrega-semanal" className="card p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Send size={17} /> Entrega Semanal
          </h2>
          <span className="text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
            Ver tudo →
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-bold">{summary.totalFrentes}</p>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Frentes
            </p>
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: summary.frentesEmRisco > 0 ? "var(--color-danger)" : "var(--color-success)" }}>
              {summary.frentesEmRisco}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Em risco
            </p>
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: summary.openBlockers > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
              {summary.openBlockers}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Bloqueios
            </p>
          </div>
        </div>
        {summary.frentesEmRisco > 0 && (
          <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--color-danger)" }}>
            <AlertTriangle size={13} /> {summary.frentesEmRisco} frente(s) podem não atingir a meta de 30 dias.
          </p>
        )}
        {summary.openBlockers > 0 && (
          <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--color-warning)" }}>
            <Lock size={13} /> {summary.openBlockers} bloqueio(s) aberto(s) aguardando destravar.
          </p>
        )}
      </Link>

      <div className="card p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <RefreshCw size={17} /> Azure DevOps
          </h2>
          {azureEnv && summary.azureConfigured && <AzureSyncButton compact />}
        </div>
        {!azureEnv ? (
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Integração não configurada.
          </p>
        ) : !summary.azureConfigured ? (
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Nenhuma frente configurada para sincronização automática.
          </p>
        ) : (
          <>
            <p className="text-sm">
              {summary.azureFrenteCount} frente(s) sincronizada(s) com o Azure DevOps.
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              {summary.lastAzureSyncAt
                ? `Última sincronização: ${new Date(summary.lastAzureSyncAt).toLocaleString("pt-BR")}`
                : "Ainda não sincronizado."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

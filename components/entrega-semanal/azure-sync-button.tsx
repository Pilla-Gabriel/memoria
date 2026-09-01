"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function AzureSyncButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setSyncing(true);
    setMessage(null);
    const res = await fetch("/api/frentes/sync-azure-all", { method: "POST" });
    const data = await res.json();
    setSyncing(false);

    if (!res.ok) {
      setMessage(data.error ?? "Não foi possível sincronizar.");
      return;
    }

    const ok = (data.results ?? []).filter((r: { ok: boolean }) => r.ok).length;
    const failed = (data.results ?? []).length - ok;
    setMessage(failed > 0 ? `${ok} frente(s) sincronizada(s), ${failed} falharam.` : `${ok} frente(s) sincronizada(s).`);
    router.refresh();
  }

  return (
    <div className={compact ? "" : "flex flex-col items-end gap-1"}>
      <button
        onClick={handleClick}
        disabled={syncing}
        className="text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
        style={{ color: "var(--color-primary)" }}
      >
        <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Sincronizando..." : "Forçar sincronização agora"}
      </button>
      {message && (
        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
          {message}
        </p>
      )}
    </div>
  );
}

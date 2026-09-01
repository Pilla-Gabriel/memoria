"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";

export function TriggerReportButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/weekly-reports/trigger", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    setMessage(res.ok ? `${data.created.length} relatório(s) de ${data.kind.toLowerCase()} gerado(s).` : data.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={handleClick} disabled={loading} className="btn-accent px-4 py-2.5 text-sm flex items-center gap-2 disabled:opacity-60">
        <PlayCircle size={16} />
        {loading ? "Gerando..." : "Gerar relatório agora"}
      </button>
      {message && (
        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
          {message}
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type LogEntry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { name: string };
};

const DANGER_ACTIONS = ["EXCLUIDA", "CANCELADA", "ATRASADA", "ARQUIVADA"];
const SUCCESS_ACTIONS = ["CRIADA", "APROVADA", "CONCLUIDA", "ATINGIDA", "AUTO_APROVADA"];
const WARNING_ACTIONS = ["PRORROGACAO", "SOLICITADA", "STATUS"];

function actionColor(action: string) {
  if (DANGER_ACTIONS.some((k) => action.includes(k))) return "var(--color-danger)";
  if (SUCCESS_ACTIONS.some((k) => action.includes(k))) return "var(--color-success)";
  if (WARNING_ACTIONS.some((k) => action.includes(k))) return "var(--color-warning)";
  return "var(--color-text)";
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/audit")
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? "Erro ao carregar");
        }
        return r.json();
      })
      .then((data) => setLogs(data.logs ?? []))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: "var(--color-danger)" }}>{error}</p>;

  if (logs === null) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Auditoria</h1>
          <p style={{ color: "var(--color-text-secondary)" }}>Trilha completa de mudanças relevantes no sistema.</p>
        </div>
        <div className="card p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Auditoria</h1>
        <p style={{ color: "var(--color-text-secondary)" }}>Trilha completa de mudanças relevantes no sistema.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: "var(--color-border)" }}>
                <th className="p-4 font-semibold">Quando</th>
                <th className="p-4 font-semibold">Usuário</th>
                <th className="p-4 font-semibold">Entidade</th>
                <th className="p-4 font-semibold">Ação</th>
                <th className="p-4 font-semibold">Alteração</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                  <td className="p-4 whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                    {new Date(log.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-4">{log.user.name}</td>
                  <td className="p-4">
                    {log.entityType} <span style={{ color: "var(--color-text-secondary)" }}>#{log.entityId.slice(0, 6)}</span>
                  </td>
                  <td className="p-4 font-medium" style={{ color: actionColor(log.action) }}>
                    {log.action.replaceAll("_", " ")}
                  </td>
                  <td className="p-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {log.field ? `${log.field}: ${log.oldValue ?? "-"} → ${log.newValue ?? "-"}` : "-"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center" style={{ color: "var(--color-text-secondary)" }}>
                    Nenhum registro de auditoria ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

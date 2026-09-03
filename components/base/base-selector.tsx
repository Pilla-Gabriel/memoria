"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initialsForName } from "@/lib/base-color";

type AccessibleBase = { id: string; slug: string; name: string; color: string };

// A seleção de base é a continuação do login — o usuário ainda não entrou
// no app, então usa a mesma casca visual (AuthShell) em vez de já mudar
// para a identidade das telas internas.
export function BaseSelector({ bases }: { bases: AccessibleBase[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoSelect = bases.length === 1;

  async function select(baseId: string) {
    setError(null);
    setLoadingId(baseId);
    try {
      const res = await fetch("/api/base/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Não foi possível selecionar a base");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setLoadingId(null);
      setError(e instanceof Error ? e.message : "Não foi possível selecionar a base");
    }
  }

  useEffect(() => {
    if (autoSelect) select(bases[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelect]);

  if (autoSelect) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Entrando em {bases[0].name}...
      </p>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-bold mb-1">Selecione uma base</h2>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
        Tarefas, metas, frentes e relatórios são separados por base.
      </p>

      {error && (
        <p className="text-sm rounded-lg px-3 py-2 mb-4" style={{ background: "#fee2e2", color: "#991b1b" }}>
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {bases.map((base) => (
          <button
            key={base.id}
            type="button"
            onClick={() => select(base.id)}
            disabled={loadingId !== null}
            className="flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-shadow hover:shadow-md disabled:opacity-60"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: base.color }}
            >
              {initialsForName(base.name)}
            </span>
            <span className="text-sm font-semibold">{base.name}</span>
            {loadingId === base.id && (
              <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                Entrando...
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

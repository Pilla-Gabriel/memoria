"use client";

import { useEffect, useState, type ReactNode } from "react";

export type PersonalizableItem = {
  id: string;
  active: boolean;
  userId: string | null;
  overridesId: string | null;
};

type Props<T extends PersonalizableItem> = {
  apiBase: string; // ex.: "/api/admin/checkin-slots"
  currentUserId: string;
  // "personal": lista efetiva do usuário logado (usada em Configurações, por
  // qualquer papel). "default": só o conjunto padrão compartilhado, editável
  // só por ADMIN em Administração — cria/edita/apaga o padrão em si e pode
  // "aplicar pra todos" (descartar personalizações de todo mundo).
  mode: "personal" | "default";
  renderLabel: (item: T) => ReactNode;
  renderForm: (params: { onSubmit: (data: Record<string, unknown>) => Promise<boolean> }) => ReactNode;
  emptyMessage?: string;
};

export function PersonalizableSection<T extends PersonalizableItem>({
  apiBase,
  currentUserId,
  mode,
  renderLabel,
  renderForm,
  emptyMessage = "Nada cadastrado ainda.",
}: Props<T>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [mirrorMsg, setMirrorMsg] = useState<string | null>(null);

  const query = mode === "default" ? "?scope=default" : "";

  async function load() {
    const res = await fetch(`${apiBase}${query}`);
    const data = await res.json();
    const list: T[] = data.slots ?? data.questions ?? data.categories ?? [];
    setItems(list);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, mode]);

  async function create(data: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`${apiBase}${mode === "default" ? "?scope=default" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return false;
    await load();
    return true;
  }

  async function toggle(item: T) {
    await fetch(`${apiBase}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    load();
  }

  async function remove(item: T) {
    await fetch(`${apiBase}/${item.id}`, { method: "DELETE" });
    load();
  }

  async function mirror(item: T) {
    setMirrorMsg(null);
    const res = await fetch(`${apiBase}/${item.id}/mirror`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setMirrorMsg(
      res.ok
        ? `Aplicado para todos — ${data.count} personalização(ões) descartada(s).`
        : (data.error ?? "Não foi possível aplicar para todos.")
    );
  }

  // Num item pessoal (userId = o próprio usuário), "excluir" some com o item
  // de vez — se ele substituía um padrão (overridesId preenchido), o padrão
  // volta a aparecer pra esse usuário. Um padrão (userId null), pra quem não
  // é ADMIN, nunca pode ser removido diretamente: o toggle de ativo/inativo
  // já cobre "excluir sem afetar os demais" (cria a cópia pessoal desativada).
  function canRemoveDirectly(item: T) {
    return mode === "default" || item.userId === currentUserId;
  }

  return (
    <div className="space-y-3">
      {renderForm({ onSubmit: create })}

      {mirrorMsg && (
        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
          {mirrorMsg}
        </p>
      )}

      <div className="card divide-y" style={{ borderColor: "var(--color-border)" }}>
        {items === null && (
          <p className="p-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Carregando...
          </p>
        )}
        {items?.map((item) => (
          <div key={item.id} className="p-4 flex items-center justify-between gap-3">
            <span className="text-sm flex items-center gap-2 flex-wrap">
              {renderLabel(item)}
              {mode === "personal" && (
                <span
                  className="text-xs rounded-full px-2 py-0.5"
                  style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}
                >
                  {item.userId === null ? "Padrão" : "Seu"}
                </span>
              )}
            </span>
            <span className="flex items-center gap-3 shrink-0">
              {mode === "default" && (
                <button
                  onClick={() => mirror(item)}
                  className="text-xs font-semibold"
                  style={{ color: "var(--color-primary)" }}
                  title="Descarta as personalizações de todos os usuários para este item, revertendo todo mundo ao padrão atual"
                >
                  Aplicar p/ todos
                </button>
              )}
              <button
                onClick={() => toggle(item)}
                className="text-xs font-semibold"
                style={{ color: item.active ? "var(--color-success)" : "var(--color-text-secondary)" }}
              >
                {item.active ? "Ativo" : "Inativo"}
              </button>
              {canRemoveDirectly(item) && (
                <button
                  onClick={() => remove(item)}
                  className="text-xs font-semibold"
                  style={{ color: "var(--color-danger)" }}
                >
                  Remover
                </button>
              )}
            </span>
          </div>
        ))}
        {items?.length === 0 && (
          <p className="p-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  );
}

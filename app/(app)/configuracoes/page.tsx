"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/providers/theme-provider";
import { Sun, Moon, Pencil, Check, X } from "lucide-react";

const ROLE_LABEL: Record<string, string> = { USER: "Usuário", LEADER: "Líder", ADMIN: "Administrador" };

export default function ConfiguracoesPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session?.user?.name]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    setSavingName(true);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSavingName(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setNameError(json.error ?? "Não foi possível salvar o nome.");
      return;
    }
    await update({ name });
    setEditingName(false);
    router.refresh();
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/me/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: json.error ?? "Não foi possível alterar a senha." });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setMessage({ type: "ok", text: "Senha alterada com sucesso." });
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <div className="card p-6">
        <h2 className="font-semibold mb-3">Perfil</h2>
        <div className="text-sm space-y-2.5">
          {editingName ? (
            <form onSubmit={saveName} className="flex items-center gap-2">
              <strong className="shrink-0">Nome:</strong>
              <input
                autoFocus
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
              <button type="submit" disabled={savingName} className="p-1.5 rounded-lg disabled:opacity-60" style={{ color: "var(--color-success)" }} aria-label="Salvar nome">
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingName(false);
                  setNameError(null);
                  setName(session?.user?.name ?? "");
                }}
                className="p-1.5 rounded-lg"
                style={{ color: "var(--color-text-secondary)" }}
                aria-label="Cancelar"
              >
                <X size={16} />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <p>
                <strong>Nome:</strong> {session?.user?.name}
              </p>
              <button
                onClick={() => setEditingName(true)}
                className="p-1 rounded-lg"
                style={{ color: "var(--color-primary)" }}
                aria-label="Editar nome"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
          {nameError && (
            <p className="text-xs" style={{ color: "var(--color-danger)" }}>
              {nameError}
            </p>
          )}
          <p>
            <strong>E-mail:</strong> {session?.user?.email}
          </p>
          <p>
            <strong>Perfil:</strong> {ROLE_LABEL[session?.user?.role ?? ""] ?? session?.user?.role}
          </p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-3">Aparência</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme("LIGHT")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium"
            style={{
              borderColor: "var(--color-border)",
              background: theme === "LIGHT" ? "var(--color-primary)" : "transparent",
              color: theme === "LIGHT" ? "#fff" : "var(--color-text)",
            }}
          >
            <Sun size={16} /> Claro
          </button>
          <button
            onClick={() => setTheme("DARK")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium"
            style={{
              borderColor: "var(--color-border)",
              background: theme === "DARK" ? "var(--color-primary)" : "transparent",
              color: theme === "DARK" ? "#fff" : "var(--color-text)",
            }}
          >
            <Moon size={16} /> Escuro
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-3">Alterar senha</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <input
            type="password"
            required
            placeholder="Senha atual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Nova senha"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          {message && (
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{
                background: message.type === "ok" ? "rgba(34,197,94,0.1)" : "#fee2e2",
                color: message.type === "ok" ? "#166534" : "#991b1b",
              }}
            >
              {message.text}
            </p>
          )}
          <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 text-sm disabled:opacity-60">
            {saving ? "Salvando..." : "Alterar senha"}
          </button>
        </form>
      </div>
    </div>
  );
}

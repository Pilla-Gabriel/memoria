"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PlayCircle, Pencil, UserPlus } from "lucide-react";
import { CheckInSlotsSection } from "@/components/settings/checkin-slots-section";
import { CheckInQuestionsSection } from "@/components/settings/checkin-questions-section";
import { TaskCategoriesSection } from "@/components/settings/task-categories-section";

type User = { id: string; name: string; email: string; role: string; active: boolean };

const TABS = ["Usuários", "Horários de check-in", "Perguntas", "Categorias de tarefas"] as const;

export function AdminPageClient() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Usuários");
  const [users, setUsers] = useState<User[]>([]);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  const [showNewUser, setShowNewUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("USER");
  const [newUserError, setNewUserError] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editUserError, setEditUserError] = useState<string | null>(null);

  async function loadAll() {
    const u = await fetch("/api/admin/users").then((r) => r.json());
    setUsers(u.users ?? []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function updateUser(id: string, data: Partial<User>) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    loadAll();
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setNewUserError(null);
    setSavingUser(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      }),
    });
    setSavingUser(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setNewUserError(json.error ?? "Não foi possível criar o acesso.");
      return;
    }
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserRole("USER");
    setShowNewUser(false);
    loadAll();
  }

  function startEditUser(u: User) {
    setEditingUserId(u.id);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword("");
    setEditUserError(null);
  }

  async function saveEditUser(id: string) {
    setEditUserError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        email: editEmail,
        ...(editPassword ? { password: editPassword } : {}),
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setEditUserError(json.error ?? "Não foi possível salvar.");
      return;
    }
    setEditingUserId(null);
    loadAll();
  }

  async function triggerCheckins() {
    setTriggerMsg("Disparando...");
    const res = await fetch("/api/checkin/trigger", { method: "POST" });
    const data = await res.json();
    setTriggerMsg(res.ok ? `${data.created} sessão(ões) criada(s).` : data.error);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Administração</h1>
        <div className="flex items-center gap-3">
          <button onClick={triggerCheckins} className="btn-accent px-4 py-2.5 text-sm flex items-center gap-2">
            <PlayCircle size={16} /> Disparar check-ins agora
          </button>
        </div>
      </div>
      {triggerMsg && <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{triggerMsg}</p>}

      <div
        role="tablist"
        aria-label="Seções de administração"
        className="flex gap-2 border-b overflow-x-auto"
        style={{ borderColor: "var(--color-border)" }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="px-3 py-2 text-sm font-semibold whitespace-nowrap shrink-0"
            style={{
              color: tab === t ? "var(--color-primary)" : "var(--color-text-secondary)",
              borderBottom: tab === t ? "2px solid var(--color-primary)" : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Usuários" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewUser((v) => !v)}
              className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2"
            >
              <UserPlus size={16} /> {showNewUser ? "Cancelar" : "Novo acesso"}
            </button>
          </div>

          {showNewUser && (
            <form onSubmit={addUser} className="card p-5 flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="admin-new-user-name" className="block text-xs font-medium mb-1">Nome</label>
                <input
                  id="admin-new-user-name"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--color-border)" }}
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label htmlFor="admin-new-user-email" className="block text-xs font-medium mb-1">E-mail</label>
                <input
                  id="admin-new-user-email"
                  required
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--color-border)" }}
                />
              </div>
              <div className="min-w-[140px]">
                <label htmlFor="admin-new-user-password" className="block text-xs font-medium mb-1">Senha</label>
                <input
                  id="admin-new-user-password"
                  required
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--color-border)" }}
                />
              </div>
              <div>
                <label htmlFor="admin-new-user-role" className="block text-xs font-medium mb-1">Perfil</label>
                <select
                  id="admin-new-user-role"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm bg-transparent"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <option value="USER">Usuário</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <button type="submit" disabled={savingUser} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                {savingUser ? "Criando..." : "Criar acesso"}
              </button>
              {newUserError && (
                <p className="w-full text-xs" style={{ color: "var(--color-danger)" }}>
                  {newUserError}
                </p>
              )}
            </form>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b" style={{ borderColor: "var(--color-border)" }}>
                    <th className="p-4 font-semibold">Nome</th>
                    <th className="p-4 font-semibold">E-mail</th>
                    <th className="p-4 font-semibold">Perfil</th>
                    <th className="p-4 font-semibold">Ativo</th>
                    <th className="p-4 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) =>
                    editingUserId === u.id ? (
                      <tr key={u.id} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                        <td className="p-4" colSpan={5}>
                          <div className="flex flex-wrap gap-2 items-end">
                            <div className="flex-1 min-w-[140px]">
                              <label htmlFor={`admin-edit-name-${u.id}`} className="block text-xs font-medium mb-1">Nome</label>
                              <input
                                id={`admin-edit-name-${u.id}`}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                                style={{ borderColor: "var(--color-border)" }}
                              />
                            </div>
                            <div className="flex-1 min-w-[160px]">
                              <label htmlFor={`admin-edit-email-${u.id}`} className="block text-xs font-medium mb-1">E-mail</label>
                              <input
                                id={`admin-edit-email-${u.id}`}
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                                style={{ borderColor: "var(--color-border)" }}
                              />
                            </div>
                            <div className="min-w-[140px]">
                              <label htmlFor={`admin-edit-password-${u.id}`} className="block text-xs font-medium mb-1">Nova senha (opcional)</label>
                              <input
                                id={`admin-edit-password-${u.id}`}
                                type="password"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                placeholder="Deixe em branco para manter"
                                className="w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                                style={{ borderColor: "var(--color-border)" }}
                              />
                            </div>
                            <button onClick={() => saveEditUser(u.id)} className="btn-primary px-3 py-1.5 text-xs">
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="px-3 py-1.5 text-xs rounded-lg border"
                              style={{ borderColor: "var(--color-border)" }}
                            >
                              Cancelar
                            </button>
                            {editUserError && (
                              <p className="w-full text-xs" style={{ color: "var(--color-danger)" }}>
                                {editUserError}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={u.id} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                        <td className="p-4">{u.name}</td>
                        <td className="p-4" style={{ color: "var(--color-text-secondary)" }}>{u.email}</td>
                        <td className="p-4">
                          <select
                            value={u.role}
                            onChange={(e) => updateUser(u.id, { role: e.target.value })}
                            className="rounded-lg border px-2 py-1.5 text-xs bg-transparent"
                            style={{ borderColor: "var(--color-border)" }}
                          >
                            <option value="USER">Usuário</option>
                            <option value="ADMIN">Administrador</option>
                          </select>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => updateUser(u.id, { active: !u.active })}
                            className="text-xs font-semibold"
                            style={{ color: u.active ? "var(--color-success)" : "var(--color-danger)" }}
                          >
                            {u.active ? "Ativo" : "Inativo"}
                          </button>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => startEditUser(u)}
                            aria-label="Editar"
                            className="p-1.5 rounded-lg min-w-9 min-h-9 flex items-center justify-center"
                            style={{ color: "var(--color-primary)" }}
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "Horários de check-in" && session?.user?.id && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Conjunto padrão, compartilhado entre todas as bases — usado por quem ainda não tem seus próprios
            horários (ver Configurações). Editar aqui muda o padrão pra todo mundo que não personalizou.
          </p>
          <CheckInSlotsSection currentUserId={session.user.id} mode="default" />
        </div>
      )}

      {tab === "Perguntas" && session?.user?.id && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Conjunto padrão, compartilhado entre todas as bases — usado por quem ainda não tem suas próprias
            perguntas (ver Configurações). Editar aqui muda o padrão pra todo mundo que não personalizou.
          </p>
          <CheckInQuestionsSection currentUserId={session.user.id} mode="default" />
        </div>
      )}

      {tab === "Categorias de tarefas" && session?.user?.id && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Conjunto padrão, compartilhado entre todas as bases — usado por quem ainda não tem suas próprias
            categorias (ver Configurações). Editar aqui muda o padrão pra todo mundo que não personalizou.
          </p>
          <TaskCategoriesSection currentUserId={session.user.id} mode="default" />
        </div>
      )}
    </div>
  );
}

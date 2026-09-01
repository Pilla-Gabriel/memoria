"use client";

import { useEffect, useState } from "react";
import { PlayCircle, Pencil, UserPlus } from "lucide-react";

type User = { id: string; name: string; email: string; role: string; active: boolean; leaderId: string | null };
type Slot = { id: string; time: string; label: string; active: boolean };
type Question = { id: string; text: string; category: string; active: boolean };
type Category = { id: string; name: string; active: boolean };

const TABS = ["Usuários", "Horários de check-in", "Perguntas", "Categorias de tarefas"] as const;

export function AdminPageClient() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Usuários");
  const [users, setUsers] = useState<User[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newSlotTime, setNewSlotTime] = useState("");
  const [newSlotLabel, setNewSlotLabel] = useState("");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionCategory, setNewQuestionCategory] = useState("DAILY");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  const [showNewUser, setShowNewUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("USER");
  const [newUserLeaderId, setNewUserLeaderId] = useState("");
  const [newUserError, setNewUserError] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editUserError, setEditUserError] = useState<string | null>(null);

  async function loadAll() {
    const [u, s, q, c] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/checkin-slots").then((r) => r.json()),
      fetch("/api/admin/checkin-questions").then((r) => r.json()),
      fetch("/api/admin/task-categories").then((r) => r.json()),
    ]);
    setUsers(u.users ?? []);
    setSlots(s.slots ?? []);
    setQuestions(q.questions ?? []);
    setCategories(c.categories ?? []);
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
        leaderId: newUserLeaderId || null,
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
    setNewUserLeaderId("");
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

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!newSlotTime || !newSlotLabel) return;
    await fetch("/api/admin/checkin-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time: newSlotTime, label: newSlotLabel }),
    });
    setNewSlotTime("");
    setNewSlotLabel("");
    loadAll();
  }

  async function toggleSlot(id: string, active: boolean) {
    await fetch(`/api/admin/checkin-slots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    loadAll();
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestionText) return;
    await fetch("/api/admin/checkin-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newQuestionText, category: newQuestionCategory }),
    });
    setNewQuestionText("");
    loadAll();
  }

  async function toggleQuestion(id: string, active: boolean) {
    await fetch(`/api/admin/checkin-questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    loadAll();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setCategoryError(null);
    if (!newCategoryName.trim()) return;
    const res = await fetch("/api/admin/task-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName.trim() }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setCategoryError(json.error ?? "Não foi possível criar a categoria.");
      return;
    }
    setNewCategoryName("");
    loadAll();
  }

  async function toggleCategory(id: string, active: boolean) {
    await fetch(`/api/admin/task-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
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

      <div className="flex gap-2 border-b" style={{ borderColor: "var(--color-border)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-2 text-sm font-semibold"
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
                <label className="block text-xs font-medium mb-1">Nome</label>
                <input
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--color-border)" }}
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium mb-1">E-mail</label>
                <input
                  required
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--color-border)" }}
                />
              </div>
              <div className="min-w-[140px]">
                <label className="block text-xs font-medium mb-1">Senha</label>
                <input
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
                <label className="block text-xs font-medium mb-1">Perfil</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm bg-transparent"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <option value="USER">Usuário</option>
                  <option value="LEADER">Líder</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Líder</label>
                <select
                  value={newUserLeaderId}
                  onChange={(e) => setNewUserLeaderId(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm bg-transparent"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <option value="">Nenhum</option>
                  {users
                    .filter((l) => l.role !== "USER")
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
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
                    <th className="p-4 font-semibold">Líder</th>
                    <th className="p-4 font-semibold">Ativo</th>
                    <th className="p-4 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) =>
                    editingUserId === u.id ? (
                      <tr key={u.id} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                        <td className="p-4" colSpan={6}>
                          <div className="flex flex-wrap gap-2 items-end">
                            <div className="flex-1 min-w-[140px]">
                              <label className="block text-xs font-medium mb-1">Nome</label>
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                                style={{ borderColor: "var(--color-border)" }}
                              />
                            </div>
                            <div className="flex-1 min-w-[160px]">
                              <label className="block text-xs font-medium mb-1">E-mail</label>
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                                style={{ borderColor: "var(--color-border)" }}
                              />
                            </div>
                            <div className="min-w-[140px]">
                              <label className="block text-xs font-medium mb-1">Nova senha (opcional)</label>
                              <input
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
                            <option value="LEADER">Líder</option>
                            <option value="ADMIN">Administrador</option>
                          </select>
                        </td>
                        <td className="p-4">
                          <select
                            value={u.leaderId ?? ""}
                            onChange={(e) => updateUser(u.id, { leaderId: e.target.value || null })}
                            className="rounded-lg border px-2 py-1.5 text-xs bg-transparent"
                            style={{ borderColor: "var(--color-border)" }}
                          >
                            <option value="">Nenhum</option>
                            {users
                              .filter((l) => l.role !== "USER" && l.id !== u.id)
                              .map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.name}
                                </option>
                              ))}
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

      {tab === "Horários de check-in" && (
        <div className="space-y-4">
          <form onSubmit={addSlot} className="card p-5 flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs font-medium mb-1">Horário</label>
              <input
                type="time"
                value={newSlotTime}
                onChange={(e) => setNewSlotTime(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium mb-1">Rótulo</label>
              <input
                value={newSlotLabel}
                onChange={(e) => setNewSlotLabel(e.target.value)}
                placeholder="Ex.: Check-in da manhã"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
            <button type="submit" className="btn-primary px-4 py-2 text-sm">
              Adicionar
            </button>
          </form>

          <div className="card divide-y" style={{ borderColor: "var(--color-border)" }}>
            {slots.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {s.time} — {s.label}
                </span>
                <button
                  onClick={() => toggleSlot(s.id, s.active)}
                  className="text-xs font-semibold"
                  style={{ color: s.active ? "var(--color-success)" : "var(--color-text-secondary)" }}
                >
                  {s.active ? "Ativo" : "Inativo"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Perguntas" && (
        <div className="space-y-4">
          <form onSubmit={addQuestion} className="card p-5 flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium mb-1">Pergunta</label>
              <input
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Categoria</label>
              <select
                value={newQuestionCategory}
                onChange={(e) => setNewQuestionCategory(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm bg-transparent"
                style={{ borderColor: "var(--color-border)" }}
              >
                <option value="DAILY">Diária</option>
                <option value="MONDAY_REVIEW">Revisão de segunda</option>
                <option value="FRIDAY_REVIEW">Revisão de sexta</option>
              </select>
            </div>
            <button type="submit" className="btn-primary px-4 py-2 text-sm">
              Adicionar
            </button>
          </form>

          <div className="card divide-y" style={{ borderColor: "var(--color-border)" }}>
            {questions.map((q) => (
              <div key={q.id} className="p-4 flex items-center justify-between gap-3">
                <span className="text-sm">
                  <span className="text-xs font-semibold uppercase mr-2" style={{ color: "var(--color-text-secondary)" }}>
                    {q.category.replace("_", " ")}
                  </span>
                  {q.text}
                </span>
                <button
                  onClick={() => toggleQuestion(q.id, q.active)}
                  className="text-xs font-semibold shrink-0"
                  style={{ color: q.active ? "var(--color-success)" : "var(--color-text-secondary)" }}
                >
                  {q.active ? "Ativa" : "Inativa"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Categorias de tarefas" && (
        <div className="space-y-4">
          <form onSubmit={addCategory} className="card p-5 flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium mb-1">Nome da categoria</label>
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex.: Cliente, Interno, Comercial..."
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
            <button type="submit" className="btn-primary px-4 py-2 text-sm">
              Adicionar
            </button>
            {categoryError && (
              <p className="w-full text-xs" style={{ color: "var(--color-danger)" }}>
                {categoryError}
              </p>
            )}
          </form>

          <div className="card divide-y" style={{ borderColor: "var(--color-border)" }}>
            {categories.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                <span className="text-sm">{c.name}</span>
                <button
                  onClick={() => toggleCategory(c.id, c.active)}
                  className="text-xs font-semibold shrink-0"
                  style={{ color: c.active ? "var(--color-success)" : "var(--color-text-secondary)" }}
                >
                  {c.active ? "Ativa" : "Inativa"}
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="p-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Nenhuma categoria cadastrada ainda.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

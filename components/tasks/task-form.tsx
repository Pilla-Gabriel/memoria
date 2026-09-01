"use client";

import { useEffect, useState } from "react";
import { DateQuickPicks } from "@/components/ui/date-quick-picks";

export type TaskFormValues = {
  title: string;
  description: string;
  dueDate: string;
  priority: string;
  category: string;
};

export function TaskForm({
  initialValues,
  onSubmit,
  saving,
  error,
  submitLabel,
}: {
  initialValues: TaskFormValues;
  onSubmit: (values: TaskFormValues) => void;
  saving: boolean;
  error: string | null;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initialValues.title);
  const [description, setDescription] = useState(initialValues.description);
  const [dueDate, setDueDate] = useState(initialValues.dueDate);
  const [priority, setPriority] = useState(initialValues.priority);
  const [category, setCategory] = useState(initialValues.category);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/admin/task-categories")
      .then((r) => r.json())
      .then((data) => {
        const active = (data.categories ?? []).filter((c: { active: boolean }) => c.active);
        setCategoryOptions(active.map((c: { name: string }) => c.name));
      })
      .catch(() => {});
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, description, dueDate, priority, category });
      }}
      className="card p-6 space-y-4"
    >
      <div>
        <label className="block text-sm font-medium mb-1.5">Título</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
          style={{ borderColor: "var(--color-border)" }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Descrição</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
          style={{ borderColor: "var(--color-border)" }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">Prazo</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <DateQuickPicks onPick={setDueDate} />
          <p className="text-xs mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
            Deixe em branco para marcar como &quot;sem prazo&quot; (gera alerta).
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Prioridade</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none bg-transparent"
            style={{ borderColor: "var(--color-border)" }}
          >
            <option value="BAIXA">Baixa</option>
            <option value="MEDIA">Média</option>
            <option value="ALTA">Alta</option>
            <option value="URGENTE">Urgente</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Categoria</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none bg-transparent"
          style={{ borderColor: "var(--color-border)" }}
        >
          <option value="">Sem categoria</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
          Cadastre novas categorias em Administração → Categorias de tarefas.
        </p>
      </div>

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#fee2e2", color: "#991b1b" }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 text-sm disabled:opacity-60">
        {saving ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { DateQuickPicks } from "@/components/ui/date-quick-picks";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError, bannerMessage, fieldErrorProps, useFocusFieldError } from "@/components/ui/field-error";
import type { FormError } from "@/lib/form-error";

const FIELD_IDS: Record<string, string> = {
  title: "task-title",
  description: "task-description",
  dueDate: "task-due-date",
  priority: "task-priority",
  category: "task-category",
};

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
  error: FormError | null;
  submitLabel: string;
}) {
  useFocusFieldError(error, FIELD_IDS);
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
        <label htmlFor="task-title" className="block text-sm font-medium mb-1.5">Título</label>
        <input
          id="task-title"
          {...fieldErrorProps(error, "title", "task-title")}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
          style={{ borderColor: "var(--color-border)" }}
        />
        <FieldError error={error} field="title" inputId="task-title" />
      </div>

      <div>
        <label htmlFor="task-description" className="block text-sm font-medium mb-1.5">Descrição</label>
        <textarea
          id="task-description"
          {...fieldErrorProps(error, "description", "task-description")}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
          style={{ borderColor: "var(--color-border)" }}
        />
        <FieldError error={error} field="description" inputId="task-description" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="task-due-date" className="block text-sm font-medium mb-1.5">Prazo</label>
          <input
            id="task-due-date"
            {...fieldErrorProps(error, "dueDate", "task-due-date")}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <FieldError error={error} field="dueDate" inputId="task-due-date" />
          <DateQuickPicks onPick={setDueDate} />
          <p className="text-xs mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
            Deixe em branco para marcar como &quot;sem prazo&quot; (gera alerta).
          </p>
        </div>
        <div>
          <label htmlFor="task-priority" className="block text-sm font-medium mb-1.5">Prioridade</label>
          <select
            id="task-priority"
            {...fieldErrorProps(error, "priority", "task-priority")}
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
          <FieldError error={error} field="priority" inputId="task-priority" />
        </div>
      </div>

      <div>
        <label htmlFor="task-category" className="block text-sm font-medium mb-1.5">Categoria</label>
        <select
          id="task-category"
          {...fieldErrorProps(error, "category", "task-category")}
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
        <FieldError error={error} field="category" inputId="task-category" />
        <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
          Cadastre novas categorias em Administração → Categorias de tarefas.
        </p>
      </div>

      {bannerMessage(error, FIELD_IDS) && <ErrorBanner>{bannerMessage(error, FIELD_IDS)}</ErrorBanner>}

      <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 text-sm disabled:opacity-60">
        {saving ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}

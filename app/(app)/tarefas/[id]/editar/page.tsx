"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dateInputToISOString } from "@/lib/date";
import { TaskForm, type TaskFormValues } from "@/components/tasks/task-form";

export default function EditarTarefaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [initialValues, setInitialValues] = useState<TaskFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const t = data.task;
        setInitialValues({
          title: t.title,
          description: t.description ?? "",
          dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
          priority: t.priority,
          category: t.category ?? "",
        });
      });
  }, [id]);

  async function handleSubmit(values: TaskFormValues) {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: values.title,
        description: values.description || null,
        dueDate: values.dueDate ? dateInputToISOString(values.dueDate) : null,
        priority: values.priority,
        category: values.category || null,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Não foi possível salvar a tarefa.");
      return;
    }
    router.push(`/tarefas/${id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href={`/tarefas/${id}`} className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold mt-2">Editar tarefa</h1>
      </div>

      {initialValues ? (
        <TaskForm
          initialValues={initialValues}
          onSubmit={handleSubmit}
          saving={saving}
          error={error}
          submitLabel="Salvar alterações"
        />
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>
      )}
    </div>
  );
}

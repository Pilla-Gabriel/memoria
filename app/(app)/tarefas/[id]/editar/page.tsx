"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dateInputToISOString } from "@/lib/date";
import { readFormError, type FormError } from "@/lib/form-error";
import { NotFoundState } from "@/components/ui/not-found-state";
import { TaskForm, type TaskFormValues } from "@/components/tasks/task-form";

export default function EditarTarefaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [initialValues, setInitialValues] = useState<TaskFormValues | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.task) {
          setNotFound(true);
          return;
        }
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

  if (notFound) {
    return <NotFoundState title="Tarefa não encontrada" backHref="/tarefas" backLabel="Voltar para tarefas" />;
  }

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
      setError(await readFormError(res, "Não foi possível salvar a tarefa."));
      return;
    }
    router.push(`/tarefas/${id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href={`/tarefas/${id}`} className="inline-flex min-h-6 items-center text-sm font-semibold" style={{ color: "var(--badge-primary-fg)" }}>
          ← Voltar
        </Link>
        <h1 className="page-title mt-2">Editar tarefa</h1>
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

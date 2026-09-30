"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dateInputToISOString } from "@/lib/date";
import { readFormError, type FormError } from "@/lib/form-error";
import { TaskForm, type TaskFormValues } from "@/components/tasks/task-form";

export default function NovaTarefaPage() {
  const router = useRouter();
  const [error, setError] = useState<FormError | null>(null);
  const [saving, setSaving] = useState(false);
  // Trava na hora: o "disabled" só aparece na próxima renderização e cliques
  // rápidos seguidos gravavam o registro em dobro (G-02).
  const savingRef = useRef(false);

  async function handleSubmit(values: TaskFormValues) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/tasks", {
      method: "POST",
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
    savingRef.current = false;
    if (!res.ok) {
      setError(await readFormError(res, "Não foi possível criar a tarefa."));
      return;
    }
    const { task } = await res.json();
    router.push(`/tarefas/${task.id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/tarefas" className="inline-flex min-h-6 items-center text-sm font-semibold" style={{ color: "var(--badge-primary-fg)" }}>
          ← Voltar
        </Link>
        <h1 className="page-title mt-2">Nova tarefa</h1>
      </div>

      <TaskForm
        initialValues={{ title: "", description: "", dueDate: "", priority: "MEDIA", category: "" }}
        onSubmit={handleSubmit}
        saving={saving}
        error={error}
        submitLabel="Criar tarefa"
      />
    </div>
  );
}

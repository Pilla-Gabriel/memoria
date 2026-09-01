"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dateInputToISOString } from "@/lib/date";
import { TaskForm, type TaskFormValues } from "@/components/tasks/task-form";

export default function NovaTarefaPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(values: TaskFormValues) {
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
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Não foi possível criar a tarefa.");
      return;
    }
    const { task } = await res.json();
    router.push(`/tarefas/${task.id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/tarefas" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold mt-2">Nova tarefa</h1>
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

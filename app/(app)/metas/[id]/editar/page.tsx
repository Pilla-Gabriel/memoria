"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoalForm, type GoalFormPayload, type GoalFormValues } from "@/components/goals/goal-form";

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function EditarMetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [initialValues, setInitialValues] = useState<Partial<GoalFormValues> | null>(null);

  useEffect(() => {
    fetch(`/api/goals/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const goal = data.goal;
        setInitialValues({
          title: goal.title,
          description: goal.description ?? "",
          type: goal.type,
          indicator: goal.indicator,
          targetValue: String(goal.targetValue),
          unitType: goal.unitType,
          unitLabel: goal.unitLabel ?? "",
          startDate: toDateInputValue(goal.startDate),
          dueDate: toDateInputValue(goal.dueDate),
          successCriteria: goal.successCriteria,
        });
      });
  }, [id]);

  async function handleSubmit(payload: GoalFormPayload) {
    const res = await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return json.error ?? "Não foi possível salvar a meta.";
    }
    router.push(`/metas/${id}`);
    return null;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href={`/metas/${id}`} className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold mt-2">Editar meta</h1>
      </div>

      {initialValues ? (
        <GoalForm submitLabel="Salvar alterações" initialValues={initialValues} onSubmit={handleSubmit} />
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>
      )}
    </div>
  );
}

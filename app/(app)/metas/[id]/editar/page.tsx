"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readFormError } from "@/lib/form-error";
import { NotFoundState } from "@/components/ui/not-found-state";
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
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/goals/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.goal) {
          setNotFound(true);
          return;
        }
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
      return readFormError(res, "Não foi possível salvar a meta.");
    }
    router.push(`/metas/${id}`);
    return null;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href={`/metas/${id}`} className="inline-flex min-h-6 items-center text-sm font-semibold" style={{ color: "var(--badge-primary-fg)" }}>
          ← Voltar
        </Link>
        <h1 className="page-title mt-2">Editar meta</h1>
      </div>

      {notFound ? (
        <NotFoundState title="Meta não encontrada" backHref="/metas" backLabel="Voltar para metas" />
      ) : initialValues ? (
        <GoalForm submitLabel="Salvar alterações" initialValues={initialValues} onSubmit={handleSubmit} />
      ) : (
        <p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>
      )}
    </div>
  );
}

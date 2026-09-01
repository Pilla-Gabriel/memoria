"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoalForm, type GoalFormPayload } from "@/components/goals/goal-form";

export default function NovaMetaPage() {
  const router = useRouter();

  async function handleSubmit(payload: GoalFormPayload) {
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return json.error ?? "Não foi possível criar a meta.";
    }
    const { goal } = await res.json();
    router.push(`/metas/${goal.id}`);
    return null;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/metas" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold mt-2">Nova meta</h1>
      </div>

      <GoalForm submitLabel="Criar meta" onSubmit={handleSubmit} />
    </div>
  );
}

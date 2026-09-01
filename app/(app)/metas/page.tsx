"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { GoalStatusBadge, GoalTypeLabel } from "@/components/goals/goal-status-badge";

type Goal = {
  id: string;
  title: string;
  type: string;
  status: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  dueDate: string;
};

function MetasList() {
  const searchParams = useSearchParams();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [loading, setLoading] = useState(true);
  const statusFilter = searchParams.get("status");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/goals?scope=${scope}`)
      .then((r) => r.json())
      .then((data) => setGoals(data.goals ?? []))
      .finally(() => setLoading(false));
  }, [scope]);

  const filtered = useMemo(
    () => (statusFilter ? goals.filter((g) => g.status === statusFilter) : goals),
    [goals, statusFilter]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Metas</h1>
        <Link href="/metas/nova" className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2 w-fit">
          <Plus size={16} /> Nova meta
        </Link>
      </div>

      <div className="flex rounded-xl border overflow-hidden text-sm w-fit" style={{ borderColor: "var(--color-border)" }}>
        <button
          onClick={() => setScope("mine")}
          className="px-3 py-2 font-medium"
          style={{ background: scope === "mine" ? "var(--color-primary)" : "transparent", color: scope === "mine" ? "#fff" : "var(--color-text)" }}
        >
          Minhas
        </button>
        <button
          onClick={() => setScope("team")}
          className="px-3 py-2 font-medium"
          style={{ background: scope === "team" ? "var(--color-primary)" : "transparent", color: scope === "team" ? "#fff" : "var(--color-text)" }}
        >
          Equipe
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="card p-6 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Nenhuma meta encontrada.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((goal) => {
            const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100) || 0);
            return (
              <Link key={goal.id} href={`/metas/${goal.id}`} className="card p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>
                    <GoalTypeLabel type={goal.type} />
                  </span>
                  <GoalStatusBadge status={goal.status} />
                </div>
                <h3 className="font-semibold">{goal.title}</h3>
                <div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-primary)" }} />
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
                    {goal.currentValue} / {goal.targetValue} {goal.unit} ({pct}%)
                  </p>
                </div>
                <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  Prazo: {new Date(goal.dueDate).toLocaleDateString("pt-BR")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MetasPage() {
  return (
    <Suspense fallback={<p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>}>
      <MetasList />
    </Suspense>
  );
}

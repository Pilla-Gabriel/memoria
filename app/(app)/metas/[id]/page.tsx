"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Info } from "lucide-react";
import { GoalStatusBadge, GoalTypeLabel } from "@/components/goals/goal-status-badge";

type ProgressEntry = {
  id: string;
  value: number;
  note: string | null;
  createdAt: string;
  createdBy: { name: string };
};

type GoalDetail = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  indicator: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  unitType: "PERCENTAGE" | "NUMBER";
  unitLabel: string | null;
  startDate: string;
  dueDate: string;
  successCriteria: string;
  owner: { id: string; name: string };
  progress: ProgressEntry[];
};

const STATUS_EXPLANATION: { status: string; label: string; text: string }[] = [
  { status: "EM_ANDAMENTO", label: "Em andamento", text: "Meta dentro do prazo e sem sinais de risco." },
  { status: "ATINGIDA", label: "Atingida", text: "O valor atual alcançou ou superou a meta. Uma vez atingida, o status permanece assim." },
  { status: "EM_RISCO", label: "Em risco", text: "Faltam 3 dias ou menos para o prazo e o avanço está abaixo de 80% da meta." },
  { status: "VENCIDA", label: "Vencida", text: "O prazo já passou e a meta não foi atingida." },
  { status: "CANCELADA", label: "Cancelada", text: "Meta cancelada manualmente. O status não é recalculado automaticamente." },
];

export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [goal, setGoal] = useState<GoalDetail | null>(null);
  const [value, setValue] = useState("");
  const [percentMode, setPercentMode] = useState(false);
  const [percentValue, setPercentValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showStatusInfo, setShowStatusInfo] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editNote, setEditNote] = useState("");

  async function load() {
    const res = await fetch(`/api/goals/${id}`);
    const data = await res.json();
    setGoal(data.goal);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!goal) return <p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>;

  const computedFromPercent =
    percentValue !== "" ? Math.round(((Number(percentValue) / 100) * goal.targetValue) * 100) / 100 : null;

  async function submitProgress(e: React.FormEvent) {
    e.preventDefault();
    const finalValue = goal!.unitType === "NUMBER" && percentMode ? computedFromPercent : Number(value);
    if (finalValue === null || Number.isNaN(finalValue)) return;
    setSaving(true);
    await fetch(`/api/goals/${id}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: finalValue, note: note || null }),
    });
    setSaving(false);
    setValue("");
    setPercentValue("");
    setNote("");
    load();
  }

  async function handleDeleteGoal() {
    if (!window.confirm("Excluir esta meta e todo o histórico de avanço? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    router.push("/metas");
  }

  function startEditProgress(p: ProgressEntry) {
    setEditingProgressId(p.id);
    setEditValue(String(p.value));
    setEditNote(p.note ?? "");
  }

  async function saveEditProgress(progressId: string) {
    await fetch(`/api/goals/${id}/progress/${progressId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: Number(editValue), note: editNote || null }),
    });
    setEditingProgressId(null);
    load();
  }

  async function deleteProgress(progressId: string) {
    if (!window.confirm("Excluir este registro de avanço?")) return;
    await fetch(`/api/goals/${id}/progress/${progressId}`, { method: "DELETE" });
    load();
  }

  const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100) || 0);
  const statusInfo = STATUS_EXPLANATION.find((s) => s.status === goal.status);
  const daysRemaining = Math.ceil((new Date(goal.dueDate).getTime() - Date.now()) / 86400000);
  const daysLabel =
    goal.status === "ATINGIDA" || goal.status === "CANCELADA"
      ? null
      : goal.status === "VENCIDA"
      ? `Venceu em ${new Date(goal.dueDate).toLocaleDateString("pt-BR")}`
      : daysRemaining === 0
      ? "Vence hoje"
      : `${daysRemaining} dia(s) restante(s)`;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/metas" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          ← Voltar
        </Link>
        <div className="flex items-center gap-3">
          <Link href={`/metas/${id}/editar`} className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--color-primary)" }}>
            <Pencil size={15} /> Editar
          </Link>
          <button
            onClick={handleDeleteGoal}
            disabled={deleting}
            className="text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
            style={{ color: "#dc2626" }}
          >
            <Trash2 size={15} /> Excluir
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-semibold uppercase mb-1" style={{ color: "var(--color-text-secondary)" }}>
              <GoalTypeLabel type={goal.type} /> · {goal.indicator}
            </p>
            <h1 className="text-xl font-bold">{goal.title}</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <GoalStatusBadge status={goal.status} />
            {daysLabel && (
              <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                {daysLabel} · {pct}% do alvo
              </p>
            )}
            <button
              onClick={() => setShowStatusInfo((v) => !v)}
              className="text-xs flex items-center gap-1"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <Info size={12} /> Como funciona o status?
            </button>
          </div>
        </div>

        {showStatusInfo && (
          <div className="mb-4 rounded-lg border p-3 text-xs space-y-1.5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
            {STATUS_EXPLANATION.map((s) => (
              <p key={s.status}>
                <span className="font-semibold">{s.label}:</span> {s.text}
              </p>
            ))}
          </div>
        )}

        {goal.description && <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>{goal.description}</p>}

        <div className="mb-4">
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-primary)" }} />
          </div>
          <p className="text-xs mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
            {goal.currentValue} / {goal.targetValue} {goal.unit} ({pct}%)
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Responsável</p>
            <p>{goal.owner.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Prazo</p>
            <p>{new Date(goal.dueDate).toLocaleDateString("pt-BR")}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Critério de sucesso</p>
            <p>{goal.successCriteria}</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-3">Registrar avanço</h2>

        {goal.unitType === "NUMBER" && (
          <div className="flex rounded-xl border overflow-hidden text-xs w-fit mb-3" style={{ borderColor: "var(--color-border)" }}>
            <button
              type="button"
              onClick={() => setPercentMode(false)}
              className="px-3 py-1.5 font-medium"
              style={{ background: !percentMode ? "var(--color-primary)" : "transparent", color: !percentMode ? "#fff" : "var(--color-text)" }}
            >
              Informar valor
            </button>
            <button
              type="button"
              onClick={() => setPercentMode(true)}
              className="px-3 py-1.5 font-medium"
              style={{ background: percentMode ? "var(--color-primary)" : "transparent", color: percentMode ? "#fff" : "var(--color-text)" }}
            >
              Informar %
            </button>
          </div>
        )}

        <form onSubmit={submitProgress} className="flex flex-wrap items-start gap-2 mb-4">
          {goal.unitType === "NUMBER" && percentMode ? (
            <div>
              <input
                type="number"
                step="any"
                min={0}
                max={100}
                required
                value={percentValue}
                onChange={(e) => setPercentValue(e.target.value)}
                placeholder="% concluído"
                className="rounded-xl border px-3.5 py-2.5 text-sm outline-none w-40"
                style={{ borderColor: "var(--color-border)" }}
              />
              {computedFromPercent !== null && (
                <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                  = {computedFromPercent} {goal.unit} (regra de 3 sobre a meta de {goal.targetValue} {goal.unit})
                </p>
              )}
            </div>
          ) : (
            <input
              type="number"
              step="any"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Novo valor (${goal.unit})`}
              className="rounded-xl border px-3.5 py-2.5 text-sm outline-none w-40"
              style={{ borderColor: "var(--color-border)" }}
            />
          )}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Observação (opcional)"
            className="flex-1 min-w-[160px] rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <button type="submit" disabled={saving} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-60">
            {saving ? "Salvando..." : "Atualizar"}
          </button>
        </form>

        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
          Histórico
        </h3>
        <ul className="space-y-2 text-sm">
          {goal.progress.map((p) => (
            <li key={p.id} className="border-b pb-2" style={{ borderColor: "var(--color-border)" }}>
              {editingProgressId === p.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="rounded-lg border px-2.5 py-1.5 text-sm outline-none w-28"
                    style={{ borderColor: "var(--color-border)" }}
                  />
                  <input
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Observação"
                    className="flex-1 min-w-[140px] rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                    style={{ borderColor: "var(--color-border)" }}
                  />
                  <button onClick={() => saveEditProgress(p.id)} className="btn-primary px-3 py-1.5 text-xs">
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingProgressId(null)}
                    className="px-3 py-1.5 text-xs rounded-lg border"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span>
                    {p.value} {goal.unit} {p.note ? `— ${p.note}` : ""}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      {p.createdBy.name} · {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                    <button onClick={() => startEditProgress(p)} aria-label="Editar" style={{ color: "var(--color-primary)" }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteProgress(p.id)} aria-label="Excluir" style={{ color: "#dc2626" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {goal.progress.length === 0 && (
            <p style={{ color: "var(--color-text-secondary)" }}>Nenhum registro de avanço ainda.</p>
          )}
        </ul>
      </div>
    </div>
  );
}

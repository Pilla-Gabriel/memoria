"use client";

import { useState } from "react";
import { dateInputToISOString } from "@/lib/date";
import { DateQuickPicks } from "@/components/ui/date-quick-picks";

export type GoalFormValues = {
  title: string;
  description: string;
  type: string;
  indicator: string;
  targetValue: string;
  unitType: "PERCENTAGE" | "NUMBER";
  unitLabel: string;
  startDate: string;
  dueDate: string;
  successCriteria: string;
};

export type GoalFormPayload = {
  title: string;
  description: string | null;
  type: string;
  indicator: string;
  targetValue: number;
  unitType: "PERCENTAGE" | "NUMBER";
  unitLabel: string | null;
  startDate: string;
  dueDate: string;
  successCriteria: string;
};

const TEMPLATES: { label: string; values: Partial<GoalFormValues> }[] = [
  {
    label: "Semanal de entregas",
    values: { type: "SEMANAL", indicator: "% de entregas concluídas no prazo", unitType: "PERCENTAGE", unitLabel: "" },
  },
  {
    label: "Trimestral de indicador",
    values: { type: "TRIMESTRAL", indicator: "Indicador de performance", unitType: "NUMBER", unitLabel: "itens" },
  },
  {
    label: "Diária de produtividade",
    values: { type: "DIARIA", indicator: "Tarefas concluídas no dia", unitType: "NUMBER", unitLabel: "tarefas" },
  },
];

const DEFAULT_VALUES: GoalFormValues = {
  title: "",
  description: "",
  type: "SEMANAL",
  indicator: "",
  targetValue: "",
  unitType: "NUMBER",
  unitLabel: "",
  startDate: "",
  dueDate: "",
  successCriteria: "",
};

export function GoalForm({
  initialValues,
  submitLabel,
  onSubmit,
}: {
  initialValues?: Partial<GoalFormValues>;
  submitLabel: string;
  onSubmit: (payload: GoalFormPayload) => Promise<string | null | void>;
}) {
  const [values, setValues] = useState<GoalFormValues>({ ...DEFAULT_VALUES, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isCreate = !initialValues;

  function update<K extends keyof GoalFormValues>(key: K, value: GoalFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function applyTemplate(templateValues: Partial<GoalFormValues>) {
    setValues((v) => ({ ...v, ...templateValues }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (values.unitType === "NUMBER" && !values.unitLabel.trim()) {
      setError("Informe o rótulo da unidade (ex.: clientes, itens)");
      return;
    }

    setSaving(true);
    const result = await onSubmit({
      title: values.title,
      description: values.description || null,
      type: values.type,
      indicator: values.indicator,
      targetValue: Number(values.targetValue),
      unitType: values.unitType,
      unitLabel: values.unitType === "NUMBER" ? values.unitLabel.trim() : null,
      startDate: dateInputToISOString(values.startDate),
      dueDate: dateInputToISOString(values.dueDate),
      successCriteria: values.successCriteria,
    });
    setSaving(false);
    if (result) setError(result);
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      {isCreate && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Modelos</label>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => applyTemplate(t.values)}
                className="text-xs font-medium px-2.5 py-1.5 rounded-full border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-xs mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
            Pré-preenche tipo, indicador e unidade — ajuste o que precisar.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1.5">Título</label>
        <input
          required
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Ex.: Reduzir backlog em 20%"
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
          style={{ borderColor: "var(--color-border)" }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Descrição</label>
        <textarea
          rows={2}
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
          style={{ borderColor: "var(--color-border)" }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">Tipo</label>
          <select
            value={values.type}
            onChange={(e) => update("type", e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none bg-transparent"
            style={{ borderColor: "var(--color-border)" }}
          >
            <option value="DIARIA">Diária</option>
            <option value="SEMANAL">Semanal</option>
            <option value="MENSAL">Mensal</option>
            <option value="TRIMESTRAL">Trimestral</option>
            <option value="ANUAL">Anual</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Indicador</label>
          <input
            required
            value={values.indicator}
            onChange={(e) => update("indicator", e.target.value)}
            placeholder="Ex.: % de backlog"
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Unidade</label>
        <div className="flex rounded-xl border overflow-hidden text-sm w-fit mb-2" style={{ borderColor: "var(--color-border)" }}>
          <button
            type="button"
            onClick={() => update("unitType", "PERCENTAGE")}
            className="px-3.5 py-2 font-medium"
            style={{
              background: values.unitType === "PERCENTAGE" ? "var(--color-primary)" : "transparent",
              color: values.unitType === "PERCENTAGE" ? "#fff" : "var(--color-text)",
            }}
          >
            Porcentagem %
          </button>
          <button
            type="button"
            onClick={() => update("unitType", "NUMBER")}
            className="px-3.5 py-2 font-medium"
            style={{
              background: values.unitType === "NUMBER" ? "var(--color-primary)" : "transparent",
              color: values.unitType === "NUMBER" ? "#fff" : "var(--color-text)",
            }}
          >
            Dado (número)
          </button>
        </div>
        {values.unitType === "NUMBER" && (
          <input
            required
            value={values.unitLabel}
            onChange={(e) => update("unitLabel", e.target.value)}
            placeholder="Rótulo da unidade — ex.: clientes, itens, projetos"
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Meta (valor{values.unitType === "PERCENTAGE" ? " em %" : ""})
          </label>
          <input
            required
            type="number"
            step="any"
            value={values.targetValue}
            onChange={(e) => update("targetValue", e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Prazo</label>
          <input
            required
            type="date"
            value={values.dueDate}
            onChange={(e) => update("dueDate", e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <DateQuickPicks onPick={(v) => update("dueDate", v)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Início</label>
        <input
          required
          type="date"
          value={values.startDate}
          onChange={(e) => update("startDate", e.target.value)}
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
          style={{ borderColor: "var(--color-border)" }}
        />
        <DateQuickPicks onPick={(v) => update("startDate", v)} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Critério de sucesso</label>
        <textarea
          required
          rows={2}
          value={values.successCriteria}
          onChange={(e) => update("successCriteria", e.target.value)}
          placeholder="O que define que essa meta foi cumprida?"
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
          style={{ borderColor: "var(--color-border)" }}
        />
      </div>

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#fee2e2", color: "#991b1b" }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 text-sm disabled:opacity-60">
        {saving ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}

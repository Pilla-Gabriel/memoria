"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Copy } from "lucide-react";
import { dateInputToISOString } from "@/lib/date";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError, bannerMessage, fieldErrorProps, useFocusFieldError } from "@/components/ui/field-error";
import { readFormError, type FormError } from "@/lib/form-error";

const FIELD_IDS: Record<string, string> = {
  name: "frente-name",
  description: "frente-description",
  indicator: "frente-indicator",
  baselineValue: "frente-baseline",
  targetValue: "frente-target-value",
  unit: "frente-unit",
  targetDate: "frente-target-date",
  source: "frente-source",
  sourceDetail: "frente-source-detail",
};

export function NovaFrenteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateFromId = searchParams.get("duplicateFrom");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [indicator, setIndicator] = useState("");
  const [unit, setUnit] = useState("");
  const [baselineValue, setBaselineValue] = useState("0");
  const [targetValue, setTargetValue] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [source, setSource] = useState("OUTRA");
  const [sourceDetail, setSourceDetail] = useState("");
  const [error, setError] = useState<FormError | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicatedFromName, setDuplicatedFromName] = useState<string | null>(null);
  useFocusFieldError(error, FIELD_IDS);

  useEffect(() => {
    if (!duplicateFromId) return;
    fetch(`/api/frentes/${duplicateFromId}`)
      .then((r) => r.json())
      .then((data) => {
        const f = data.frente;
        if (!f) return;
        setDescription(f.description ?? "");
        setIndicator(f.indicator);
        setUnit(f.unit);
        setBaselineValue(String(f.targetValue));
        setSource(f.source);
        setSourceDetail(f.sourceDetail ?? "");
        setDuplicatedFromName(f.name);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateFromId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/frentes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        indicator,
        unit,
        baselineValue: Number(baselineValue),
        targetValue: Number(targetValue),
        targetDate: dateInputToISOString(targetDate),
        source,
        sourceDetail: sourceDetail || null,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      setError(await readFormError(res, "Não foi possível criar a frente."));
      return;
    }
    const { frente } = await res.json();
    router.push(`/entrega-semanal/frentes/${frente.id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/entrega-semanal" className="text-sm font-semibold" style={{ color: "var(--badge-primary-fg)" }}>
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold mt-2">Nova frente</h1>
      </div>

      {duplicatedFromName && (
        <p
          className="text-sm rounded-xl px-3.5 py-2.5 flex items-center gap-2"
          style={{ background: "var(--badge-primary-bg)", color: "var(--badge-primary-fg)" }}
        >
          <Copy size={14} /> Duplicando indicador, unidade e fonte de <strong>{duplicatedFromName}</strong> — ajuste nome, alvo e prazo para o novo período.
        </p>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label htmlFor="frente-name" className="block text-sm font-medium mb-1.5">Nome da frente</label>
          <input
            id="frente-name"
            {...fieldErrorProps(error, "name", "frente-name")}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <FieldError error={error} field="name" inputId="frente-name" />
        </div>

        <div>
          <label htmlFor="frente-description" className="block text-sm font-medium mb-1.5">Descrição</label>
          <textarea
            id="frente-description"
            {...fieldErrorProps(error, "description", "frente-description")}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <FieldError error={error} field="description" inputId="frente-description" />
        </div>

        <div>
          <label htmlFor="frente-indicator" className="block text-sm font-medium mb-1.5">Indicador</label>
          <input
            id="frente-indicator"
            {...fieldErrorProps(error, "indicator", "frente-indicator")}
            required
            value={indicator}
            onChange={(e) => setIndicator(e.target.value)}
            placeholder="Ex.: % do backlog entregue com qualidade"
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <FieldError error={error} field="indicator" inputId="frente-indicator" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="frente-baseline" className="block text-sm font-medium mb-1.5">Linha de base</label>
            <input
              id="frente-baseline"
              {...fieldErrorProps(error, "baselineValue", "frente-baseline")}
              required
              type="number"
              step="any"
              value={baselineValue}
              onChange={(e) => setBaselineValue(e.target.value)}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
            <FieldError error={error} field="baselineValue" inputId="frente-baseline" />
          </div>
          <div>
            <label htmlFor="frente-target-value" className="block text-sm font-medium mb-1.5">Meta 30 dias</label>
            <input
              id="frente-target-value"
              {...fieldErrorProps(error, "targetValue", "frente-target-value")}
              required
              type="number"
              step="any"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
            <FieldError error={error} field="targetValue" inputId="frente-target-value" />
          </div>
          <div>
            <label htmlFor="frente-unit" className="block text-sm font-medium mb-1.5">Unidade</label>
            <input
              id="frente-unit"
              {...fieldErrorProps(error, "unit", "frente-unit")}
              required
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="%, itens..."
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
            <FieldError error={error} field="unit" inputId="frente-unit" />
          </div>
        </div>

        <div>
          <label htmlFor="frente-target-date" className="block text-sm font-medium mb-1.5">Prazo da meta</label>
          <input
            id="frente-target-date"
            {...fieldErrorProps(error, "targetDate", "frente-target-date")}
            required
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <FieldError error={error} field="targetDate" inputId="frente-target-date" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="frente-source" className="block text-sm font-medium mb-1.5">Fonte dos números</label>
            <select
              id="frente-source"
              {...fieldErrorProps(error, "source", "frente-source")}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none bg-transparent"
              style={{ borderColor: "var(--color-border)" }}
            >
              <option value="AZURE_DEVOPS">Azure DevOps</option>
              <option value="TEAMS">Teams</option>
              <option value="SLACK">Slack</option>
              <option value="DOCUMENTACAO_INTERNA">Documentação interna</option>
              <option value="OUTRA">Outra</option>
            </select>
            <FieldError error={error} field="source" inputId="frente-source" />
          </div>
          <div>
            <label htmlFor="frente-source-detail" className="block text-sm font-medium mb-1.5">Detalhe da fonte (link/board)</label>
            <input
              id="frente-source-detail"
              {...fieldErrorProps(error, "sourceDetail", "frente-source-detail")}
              value={sourceDetail}
              onChange={(e) => setSourceDetail(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
            <FieldError error={error} field="sourceDetail" inputId="frente-source-detail" />
          </div>
        </div>

        {bannerMessage(error, FIELD_IDS) && <ErrorBanner>{bannerMessage(error, FIELD_IDS)}</ErrorBanner>}

        <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 text-sm disabled:opacity-60">
          {saving ? "Salvando..." : "Criar frente"}
        </button>
      </form>
    </div>
  );
}

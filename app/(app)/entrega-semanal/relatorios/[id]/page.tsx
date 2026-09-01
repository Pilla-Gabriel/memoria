"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { Download, AlertTriangle, Sparkles } from "lucide-react";
import { RiskBadge, ReportStatusBadge } from "@/components/entrega-semanal/badges";

type FrenteComparison = {
  frente: { id: string; name: string; unit: string };
  previousValue: number;
  currentValue: number;
  targetValue: number;
  deltaAbs: number;
  deltaPct: number | null;
  isAtRisk: boolean;
  summary: { line1: string; line2: string; line3: string };
};

type ReportData = {
  report: {
    id: string;
    kind: string;
    weekStart: string;
    status: string;
    hoje: string | null;
    semana: string | null;
    vitoria: string | null;
    createdBy: { name: string };
  };
  frentes: FrenteComparison[];
};

const KIND_LABEL: Record<string, string> = { SEGUNDA: "Segunda-feira", SEXTA: "Sexta-feira" };

export default function WeeklyReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [data, setData] = useState<ReportData | null>(null);
  const [hoje, setHoje] = useState("");
  const [semana, setSemana] = useState("");
  const [vitoria, setVitoria] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  async function load() {
    const res = await fetch(`/api/weekly-reports/${id}`);
    const json: ReportData = await res.json();
    setData(json);
    setHoje(json.report.hoje ?? "");

    const isEmptyDraft =
      json.report.status === "RASCUNHO" && !json.report.hoje && !json.report.semana && !json.report.vitoria;

    if (isEmptyDraft && json.frentes.length > 0) {
      const semanaDraft = json.frentes.map((f) => `${f.frente.name}: ${f.summary.line1}`).join("\n");
      const vitoriaLines = json.frentes
        .filter((f) => !f.summary.line2.includes("nenhuma entrega registrada"))
        .map((f) => `${f.frente.name}: ${f.summary.line2}`);
      setSemana(semanaDraft);
      setVitoria(vitoriaLines.join("\n"));
      setAutoFilled(true);
    } else {
      setSemana(json.report.semana ?? "");
      setVitoria(json.report.vitoria ?? "");
      setAutoFilled(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return <p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>;

  async function save(status?: "PUBLICADO") {
    setSaving(true);
    await fetch(`/api/weekly-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hoje, semana, vitoria, ...(status ? { status } : {}) }),
    });
    setSaving(false);
    load();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/entrega-semanal" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          ← Voltar
        </Link>
        <a
          href={`/api/weekly-reports/${id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="btn-accent px-4 py-2 text-sm flex items-center gap-2"
        >
          <Download size={15} /> Baixar PDF
        </a>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">{KIND_LABEL[data.report.kind]}</h1>
          <ReportStatusBadge status={data.report.status} />
        </div>
        <p style={{ color: "var(--color-text-secondary)" }}>
          Semana de {new Date(data.report.weekStart).toLocaleDateString("pt-BR")} · {data.report.createdBy.name}
        </p>
      </div>

      <div className="space-y-4">
        {data.frentes.map((f) => (
          <div key={f.frente.id} className="card p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="font-semibold text-sm">{f.frente.name}</h2>
              <RiskBadge isAtRisk={f.isAtRisk} />
            </div>
            <p className="text-sm mb-1">{f.summary.line1}</p>
            <p className="text-sm mb-1">{f.summary.line2}</p>
            <p className="text-sm">{f.summary.line3}</p>
            {f.deltaPct !== null && (
              <p
                className="text-xs mt-2 font-semibold"
                style={{ color: f.deltaAbs >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
              >
                Variação: {f.deltaAbs >= 0 ? "+" : ""}
                {f.deltaAbs} {f.frente.unit} ({f.deltaPct >= 0 ? "+" : ""}
                {f.deltaPct.toFixed(1)}%)
              </p>
            )}
          </div>
        ))}
        {data.frentes.length === 0 && (
          <div className="card p-5 text-sm flex items-center gap-2" style={{ color: "var(--color-text-secondary)" }}>
            <AlertTriangle size={16} /> Nenhuma frente ativa cadastrada.
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-1">Plano semanal</h2>
        {autoFilled && (
          <p className="text-xs flex items-center gap-1.5 mb-3" style={{ color: "var(--color-primary)" }}>
            <Sparkles size={13} /> Rascunho gerado a partir do resumo das frentes — revise antes de publicar.
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Hoje</label>
            <textarea
              rows={2}
              value={hoje}
              onChange={(e) => setHoje(e.target.value)}
              placeholder="O que será entregue no dia"
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Semana</label>
            <textarea
              rows={3}
              value={semana}
              onChange={(e) => {
                setSemana(e.target.value);
                setAutoFilled(false);
              }}
              placeholder="Principais entregas previstas"
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Vitória</label>
            <textarea
              rows={3}
              value={vitoria}
              onChange={(e) => {
                setVitoria(e.target.value);
                setAutoFilled(false);
              }}
              placeholder="Resultado já alcançado e comprovado"
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={() => save()} disabled={saving} className="px-4 py-2.5 text-sm font-semibold rounded-xl border disabled:opacity-60" style={{ borderColor: "var(--color-border)" }}>
            Salvar rascunho
          </button>
          <button onClick={() => save("PUBLICADO")} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-60">
            {saving ? "Salvando..." : "Publicar relatório"}
          </button>
        </div>
      </div>
    </div>
  );
}

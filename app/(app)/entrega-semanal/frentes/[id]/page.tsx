"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { Paperclip, AlertTriangle, RefreshCw, Copy } from "lucide-react";
import { RiskBadge, BlockerStatusBadge, SourceLabel } from "@/components/entrega-semanal/badges";

type Person = { name: string };
type Snapshot = { id: string; value: number; note: string | null; createdAt: string; createdBy: Person };
type Delivery = { id: string; title: string; evidence: string; deliveredAt: string; deliveredBy: Person };
type Blocker = {
  id: string;
  description: string;
  impact: string;
  status: string;
  createdAt: string;
  createdBy: Person;
  ownerToUnblock: Person | null;
  ownerToUnblockName: string | null;
};

type FrenteDetail = {
  id: string;
  name: string;
  description: string | null;
  indicator: string;
  unit: string;
  baselineValue: number;
  currentValue: number;
  targetValue: number;
  targetDate: string;
  source: string;
  sourceDetail: string | null;
  azureWorkItemTypes: string | null;
  owner: Person;
  snapshots: Snapshot[];
  deliveries: Delivery[];
  blockers: Blocker[];
};

export default function FrenteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [frente, setFrente] = useState<FrenteDetail | null>(null);
  const [isAtRisk, setIsAtRisk] = useState(false);

  const [snapshotValue, setSnapshotValue] = useState("");
  const [snapshotNote, setSnapshotNote] = useState("");

  const [deliveryTitle, setDeliveryTitle] = useState("");
  const [deliveryEvidence, setDeliveryEvidence] = useState("");

  const [blockerDescription, setBlockerDescription] = useState("");
  const [blockerImpact, setBlockerImpact] = useState("");
  const [blockerOwnerName, setBlockerOwnerName] = useState("");

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [savingUpdate, setSavingUpdate] = useState(false);

  async function load() {
    const res = await fetch(`/api/frentes/${id}`);
    const data = await res.json();
    setFrente(data.frente);
    setIsAtRisk(data.comparison?.isAtRisk ?? false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!frente) return <p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>;

  // As três atualizações (número, entrega, bloqueio) viviam em formulários
  // separados. Agora um único envio dispara só o que foi preenchido, em
  // paralelo, e recarrega os dados uma única vez ao final.
  async function submitWeeklyUpdate(e: React.FormEvent) {
    e.preventDefault();
    const hasSnapshot = Boolean(snapshotValue);
    const hasDelivery = Boolean(deliveryTitle && deliveryEvidence);
    const hasBlocker = Boolean(blockerDescription && blockerImpact);
    if (!hasSnapshot && !hasDelivery && !hasBlocker) return;

    setSavingUpdate(true);
    await Promise.all([
      hasSnapshot
        ? fetch(`/api/frentes/${id}/snapshot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: Number(snapshotValue), note: snapshotNote || null }),
          })
        : null,
      hasDelivery
        ? fetch(`/api/frentes/${id}/deliveries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: deliveryTitle, evidence: deliveryEvidence }),
          })
        : null,
      hasBlocker
        ? fetch(`/api/frentes/${id}/blockers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: blockerDescription,
              impact: blockerImpact,
              ownerToUnblockName: blockerOwnerName || null,
            }),
          })
        : null,
    ]);
    setSnapshotValue("");
    setSnapshotNote("");
    setDeliveryTitle("");
    setDeliveryEvidence("");
    setBlockerDescription("");
    setBlockerImpact("");
    setBlockerOwnerName("");
    setSavingUpdate(false);
    load();
  }

  async function syncAzure() {
    setSyncing(true);
    setSyncMessage(null);
    const res = await fetch(`/api/frentes/${id}/sync-azure`, { method: "POST" });
    const data = await res.json();
    setSyncing(false);
    if (!res.ok) {
      setSyncMessage(data.error ?? "Não foi possível sincronizar.");
      return;
    }
    setSyncMessage(`Sincronizado: ${data.result.done}/${data.result.total} itens concluídos.`);
    load();
  }

  async function resolveBlocker(blockerId: string, status: string) {
    await fetch(`/api/frentes/${id}/blockers/${blockerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status === "ABERTO" ? "RESOLVIDO" : "ABERTO" }),
    });
    load();
  }

  const pct =
    frente.targetValue !== frente.baselineValue
      ? Math.min(
          100,
          Math.max(0, Math.round(((frente.currentValue - frente.baselineValue) / (frente.targetValue - frente.baselineValue)) * 100))
        )
      : 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/entrega-semanal" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          ← Voltar
        </Link>
        <Link
          href={`/entrega-semanal/frentes/nova?duplicateFrom=${id}`}
          className="text-sm font-semibold flex items-center gap-1.5"
          style={{ color: "var(--color-primary)" }}
        >
          <Copy size={15} /> Duplicar esta frente
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <h1 className="text-xl font-bold">{frente.name}</h1>
          <RiskBadge isAtRisk={isAtRisk} />
        </div>
        {frente.description && (
          <p className="text-sm mb-3" style={{ color: "var(--color-text-secondary)" }}>
            {frente.description}
          </p>
        )}
        <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>
          {frente.indicator} · Fonte: <SourceLabel source={frente.source} detail={frente.sourceDetail} /> · Responsável:{" "}
          {frente.owner.name}
        </p>

        <div className="mb-2">
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-primary)" }} />
          </div>
          <p className="text-xs mt-1.5">
            Linha de base: <strong>{frente.baselineValue}</strong> {frente.unit} · Atual:{" "}
            <strong>{frente.currentValue}</strong> {frente.unit} · Meta (30 dias):{" "}
            <strong>{frente.targetValue}</strong> {frente.unit} até {new Date(frente.targetDate).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">Atualização rápida da semana</h2>
          {frente.source === "AZURE_DEVOPS" && frente.azureWorkItemTypes && (
            <button
              onClick={syncAzure}
              disabled={syncing}
              className="text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
              style={{ color: "var(--color-primary)" }}
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Sincronizando..." : "Sincronizar com Azure DevOps"}
            </button>
          )}
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Preencha só o que for relevante — número, entrega e bloqueio são salvos juntos em um único envio.
        </p>
        {syncMessage && (
          <p className="text-xs mb-3" style={{ color: "var(--color-text-secondary)" }}>
            {syncMessage}
          </p>
        )}
        <form onSubmit={submitWeeklyUpdate} className="space-y-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-secondary)" }}>
              Número
            </h3>
            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                step="any"
                value={snapshotValue}
                onChange={(e) => setSnapshotValue(e.target.value)}
                placeholder={`Novo valor (${frente.unit})`}
                className="rounded-xl border px-3.5 py-2.5 text-sm outline-none w-40"
                style={{ borderColor: "var(--color-border)" }}
              />
              <input
                value={snapshotNote}
                onChange={(e) => setSnapshotNote(e.target.value)}
                placeholder="Observação (opcional)"
                className="flex-1 min-w-[160px] rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "var(--color-text-secondary)" }}>
              <Paperclip size={13} /> Entrega (o que ficou pronto)
            </h3>
            <div className="space-y-2">
              <input
                value={deliveryTitle}
                onChange={(e) => setDeliveryTitle(e.target.value)}
                placeholder="O que foi entregue"
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
              <input
                value={deliveryEvidence}
                onChange={(e) => setDeliveryEvidence(e.target.value)}
                placeholder="ID, registro ou link de evidência"
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "var(--color-text-secondary)" }}>
              <AlertTriangle size={13} /> Bloqueio (o que está travado)
            </h3>
            <div className="space-y-2">
              <input
                value={blockerDescription}
                onChange={(e) => setBlockerDescription(e.target.value)}
                placeholder="O que está travado"
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
              <input
                value={blockerImpact}
                onChange={(e) => setBlockerImpact(e.target.value)}
                placeholder="Impacto"
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
              <input
                value={blockerOwnerName}
                onChange={(e) => setBlockerOwnerName(e.target.value)}
                placeholder="Quem pode destravar"
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
          </div>

          <button type="submit" disabled={savingUpdate} className="btn-primary w-full py-2.5 text-sm disabled:opacity-60">
            {savingUpdate ? "Salvando..." : "Salvar atualização"}
          </button>
        </form>
        {frente.snapshots.length > 0 && (
          <ul className="mt-4 pt-4 border-t space-y-1.5 text-xs" style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
            {frente.snapshots.slice(0, 6).map((s) => (
              <li key={s.id}>
                {s.value} {frente.unit} {s.note ? `— ${s.note}` : ""} · {s.createdBy.name} ·{" "}
                {new Date(s.createdAt).toLocaleDateString("pt-BR")}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Paperclip size={17} /> Entregas registradas
        </h2>
        <ul className="space-y-2 text-sm">
          {frente.deliveries.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 border-b pb-2" style={{ borderColor: "var(--color-border)" }}>
              <span>
                <strong>{d.title}</strong> — {d.evidence}
              </span>
              <span className="text-xs shrink-0" style={{ color: "var(--color-text-secondary)" }}>
                {d.deliveredBy.name} · {new Date(d.deliveredAt).toLocaleDateString("pt-BR")}
              </span>
            </li>
          ))}
          {frente.deliveries.length === 0 && (
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Nenhuma entrega registrada ainda.
            </p>
          )}
        </ul>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle size={17} /> Bloqueios
        </h2>
        <ul className="space-y-2 text-sm">
          {frente.blockers.map((b) => (
            <li key={b.id} className="border-b pb-2" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p>
                    <strong>{b.description}</strong>
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    Impacto: {b.impact} · Destrava: {b.ownerToUnblock?.name ?? b.ownerToUnblockName ?? "a definir"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <BlockerStatusBadge status={b.status} />
                  <button
                    onClick={() => resolveBlocker(b.id, b.status)}
                    className="text-xs font-semibold"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {b.status === "ABERTO" ? "Marcar resolvido" : "Reabrir"}
                  </button>
                </div>
              </div>
            </li>
          ))}
          {frente.blockers.length === 0 && (
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Nada travado no momento.
            </p>
          )}
        </ul>
      </div>
    </div>
  );
}

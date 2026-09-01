import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/rbac";
import { computeFrenteComparison, getWindowStartFor } from "@/lib/services/frentes";
import { RiskBadge, SourceLabel, ReportStatusBadge } from "@/components/entrega-semanal/badges";
import { TriggerReportButton } from "@/components/entrega-semanal/trigger-report-button";
import { Plus, AlertTriangle, Bell } from "lucide-react";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mondayOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

const KIND_LABEL: Record<string, string> = { SEGUNDA: "Segunda-feira", SEXTA: "Sexta-feira" };

export default async function EntregaSemanalPage() {
  const session = await auth();
  const user = session!.user;
  const manager = isManager(user.role);

  const frentes = await prisma.frente.findMany({
    where: { active: true },
    include: { owner: { select: { name: true } }, _count: { select: { blockers: { where: { status: "ABERTO" } } } } },
    orderBy: { createdAt: "asc" },
  });

  const weekStart = mondayOfWeek(new Date());
  const windowStart = await getWindowStartFor(user.id, weekStart);
  const comparisons = await Promise.all(frentes.map((f) => computeFrenteComparison(f.id, windowStart)));

  const [myReports, frenteAlerts] = await Promise.all([
    prisma.weeklyReport.findMany({
      where: { createdById: user.id },
      orderBy: { weekStart: "desc" },
      take: 6,
    }),
    prisma.alert.findMany({
      where: {
        userId: user.id,
        read: false,
        type: { in: ["FRENTE_EM_RISCO", "FRENTE_SEM_ATUALIZACAO", "BLOQUEIO_ABERTO"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const pendingReport = myReports.find((r) => r.status === "RASCUNHO");

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Entrega Semanal</h1>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Relatório curto, quantitativo e verificável — segunda e sexta-feira.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {manager && (
            <Link href="/entrega-semanal/frentes/nova" className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2">
              <Plus size={16} /> Nova frente
            </Link>
          )}
          {user.role === "ADMIN" && <TriggerReportButton />}
        </div>
      </div>

      {pendingReport && (
        <Link
          href={`/entrega-semanal/relatorios/${pendingReport.id}`}
          className="card p-4 flex items-center justify-between gap-3"
          style={{ background: "rgba(255,242,0,0.12)" }}
        >
          <span className="text-sm font-semibold">
            Você tem um relatório de {KIND_LABEL[pendingReport.kind]} pendente de preenchimento.
          </span>
          <span className="btn-accent px-4 py-2 text-xs">Preencher agora</span>
        </Link>
      )}

      {frenteAlerts.length > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2" style={{ color: "var(--color-text-secondary)" }}>
            <Bell size={14} /> Alertas das frentes
          </h2>
          <ul className="space-y-1.5 text-sm">
            {frenteAlerts.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <AlertTriangle size={14} style={{ color: "var(--color-warning)" }} />
                {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-text-secondary)" }}>
          Frentes
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {comparisons.map((c) => {
            const pct = c.targetValue !== c.frente.baselineValue
              ? Math.min(100, Math.max(0, Math.round(((c.currentValue - c.frente.baselineValue) / (c.targetValue - c.frente.baselineValue)) * 100)))
              : 0;
            return (
              <Link key={c.frente.id} href={`/entrega-semanal/frentes/${c.frente.id}`} className="card p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm">{c.frente.name}</h3>
                  <RiskBadge isAtRisk={c.isAtRisk} />
                </div>
                <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {c.frente.indicator}
                </p>
                <div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-primary)" }} />
                  </div>
                  <p className="text-xs mt-1.5">
                    Estava em <strong>{c.previousValue}</strong>, está em <strong>{c.currentValue}</strong>{" "}
                    {c.frente.unit} · meta {c.targetValue} {c.frente.unit}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  <span>
                    <SourceLabel source={c.frente.source} detail={c.frente.sourceDetail} linkify={false} />
                  </span>
                  {c.openBlockers.length > 0 && (
                    <span style={{ color: "var(--color-danger)" }}>{c.openBlockers.length} bloqueio(s)</span>
                  )}
                </div>
              </Link>
            );
          })}
          {frentes.length === 0 && (
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Nenhuma frente cadastrada ainda.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-text-secondary)" }}>
          Meus relatórios
        </h2>
        <div className="card divide-y" style={{ borderColor: "var(--color-border)" }}>
          {myReports.length === 0 && (
            <p className="p-5 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Nenhum relatório ainda. Relatórios são gerados automaticamente às segundas e sextas para líderes e
              administradores.
            </p>
          )}
          {myReports.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {KIND_LABEL[r.kind]} · semana de {r.weekStart.toLocaleDateString("pt-BR")}
                </p>
                <ReportStatusBadge status={r.status} />
              </div>
              <Link href={`/entrega-semanal/relatorios/${r.id}`} className="text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
                Ver
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

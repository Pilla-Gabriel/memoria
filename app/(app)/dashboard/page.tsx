import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, Circle } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveBaseId } from "@/lib/active-base";
import { runWithBase } from "@/lib/base-context";
import { getEffectiveActiveSlotsFor } from "@/lib/services/checkin";
import { daysBetween } from "@/lib/services/risk-engine";
import type { AlertType } from "@/app/generated/prisma/enums";
import { EntregaSemanalSummaryPanel } from "@/components/entrega-semanal/summary-panel";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/onboarding-checklist";

// Composição do Painel do protótipo de referência (Lovable weekly-wrapup,
// src/routes/index.tsx): manchete + chamada do check-in, faixa de
// indicadores com o bloco amarelo do ciclo, "Esta semana" e a coluna de
// metas + sinais de atenção — com os dados reais do usuário.

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const DIAS_CURTOS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Semana ISO-8601 (a mesma do "SEM 37" da referência).
function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function saudacao(date: Date) {
  const h = date.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function prazoRelativo(due: Date, today: Date) {
  const diff = Math.round((startOfDay(due).getTime() - today.getTime()) / 86400000);
  const hora = due.getHours() || due.getMinutes() ? `, ${due.getHours()}h` : "";
  if (diff === 0) return `Hoje${hora}`;
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  if (diff < 0) return `${-diff} dias atrás`;
  if (diff < 7) return `${DIAS_CURTOS[due.getDay()]}${hora}`;
  return due.toLocaleDateString("pt-BR");
}

const SITUACAO = {
  ATRASADA: { label: "ATRASADA", border: "var(--color-danger)" },
  RISCO: { label: "EM RISCO", border: "var(--color-warning)" },
  PRAZO: { label: "NO PRAZO", border: "var(--color-success)" },
} as const;

const ALERTA_TOM: Record<string, "danger" | "warning" | "ok"> = {
  ATRASADA: "danger",
  META_VENCIDA: "danger",
  BLOQUEIO_ABERTO: "danger",
  VENCE_HOJE: "warning",
  PRAZO_1D: "warning",
  META_RISCO: "warning",
  FRENTE_EM_RISCO: "warning",
  PRORROGACAO_PENDENTE: "warning",
  SEM_PRAZO: "warning",
};

// Um alerta por tipo, com contagem: listar os 3 mais recentes repetia
// "Você tem um check-in pendente." três vezes e escondia o que é grave
// (auditoria Impeccable 2026-09-29).
const ALERTA_PLURAL: Record<string, (n: number) => string> = {
  ATRASADA: (n) => `${n} tarefas em atraso`,
  META_VENCIDA: (n) => `${n} metas vencidas`,
  BLOQUEIO_ABERTO: (n) => `${n} bloqueios abertos`,
  VENCE_HOJE: (n) => `${n} tarefas vencem hoje`,
  PRAZO_1D: (n) => `${n} tarefas vencem amanhã`,
  PRAZO_3D: (n) => `${n} tarefas vencem em até 3 dias`,
  PRAZO_7D: (n) => `${n} tarefas vencem em até 7 dias`,
  SEM_PRAZO: (n) => `${n} tarefas sem prazo`,
  META_RISCO: (n) => `${n} metas em risco`,
  FRENTE_EM_RISCO: (n) => `${n} frentes em risco`,
  FRENTE_SEM_ATUALIZACAO: (n) => `${n} frentes sem atualização`,
  PRORROGACAO_PENDENTE: (n) => `${n} prorrogações aguardando aprovação`,
  CHECKIN_PENDENTE: (n) => `${n} check-ins pendentes`,
  CHECKIN_NAO_CONFIGURADO: () => "Check-in ainda não configurado",
};
const TOM_ORDEM = { danger: 0, warning: 1, ok: 2 } as const;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const baseId = await getActiveBaseId(session.user);
  if (!baseId) redirect("/selecionar-base");

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 86400000);
  const inAWeek = new Date(today.getTime() + 7 * 86400000);
  const OPEN = { notIn: ["CONCLUIDA", "CANCELADA"] as ("CONCLUIDA" | "CANCELADA")[] };

  const [
    total,
    concluida,
    cancelada,
    abertas,
    vencemHoje,
    atrasada,
    prorrogacoes,
    semana,
    metas,
    metasTotal,
    alertas,
    alertasNaoLidos,
    checkinPendente,
    checkinsRespondidos,
    checkinsIgnorados,
    activeSlots,
    currentUser,
  ] = await runWithBase(baseId, () =>
    Promise.all([
      prisma.task.count({ where: { ownerId: userId } }),
      prisma.task.count({ where: { ownerId: userId, status: "CONCLUIDA" } }),
      prisma.task.count({ where: { ownerId: userId, status: "CANCELADA" } }),
      prisma.task.count({ where: { ownerId: userId, status: OPEN } }),
      prisma.task.count({ where: { ownerId: userId, status: OPEN, dueDate: { gte: today, lt: tomorrow } } }),
      prisma.task.count({ where: { ownerId: userId, status: "ATRASADA" } }),
      prisma.taskExtensionRequest.count({
        where: { status: "PENDENTE_APROVACAO", task: { ownerId: userId, baseId } },
      }),
      prisma.task.findMany({
        where: { ownerId: userId, status: OPEN, dueDate: { not: null, lt: inAWeek } },
        include: { owner: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
        take: 6,
      }),
      prisma.goal.findMany({
        where: { ownerId: userId, status: { in: ["EM_ANDAMENTO", "EM_RISCO"] } },
        orderBy: { dueDate: "asc" },
        take: 3,
      }),
      prisma.goal.count({ where: { ownerId: userId } }),
      prisma.alert.groupBy({
        by: ["type"],
        where: { userId, read: false },
        _count: { _all: true },
      }),
      prisma.alert.count({ where: { userId, read: false } }),
      prisma.checkInSession.findFirst({
        where: { userId, status: "PENDENTE" },
        orderBy: { date: "desc" },
        select: { id: true },
      }),
      prisma.checkInSession.count({ where: { userId, status: "RESPONDIDO" } }),
      prisma.checkInSession.count({ where: { userId, status: "IGNORADO" } }),
      getEffectiveActiveSlotsFor(userId).then((slots) => slots.length),
      prisma.user.findUnique({ where: { id: userId }, select: { onboardingDismissedAt: true } }),
    ])
  );

  const totalForRate = total - cancelada;
  const taxaEntrega = totalForRate > 0 ? Math.round((concluida / totalForRate) * 100) : 0;
  const checkinsTotal = checkinsRespondidos + checkinsIgnorados;
  const taxaCheckin = checkinsTotal > 0 ? Math.round((checkinsRespondidos / checkinsTotal) * 100) : null;
  const firstName = session.user.name?.split(" ")[0] ?? "";
  const diaSemana = now.getDay();
  const fechamento =
    diaSemana === 5 ? "Entrega semanal hoje" : diaSemana === 6 || diaSemana === 0 ? "Semana encerrada" : "Entrega semanal na sexta";

  const onboardingSteps: OnboardingStep[] = [
    { label: "Responda seu primeiro check-in", done: checkinsRespondidos > 0, href: "/checkin" },
    { label: "Crie sua primeira meta", done: metasTotal > 0, href: "/metas/nova" },
    { label: "Configure seus horários de check-in", done: activeSlots > 0, href: "/configuracoes" },
  ];
  // Dispensar o card não pode significar "nunca mais" enquanto sobrar passo
  // pendente — pra alguém esquecido, "fechar isso depois" e nunca mais ver é
  // o desfecho mais provável, não a exceção. Volta a aparecer depois de
  // ONBOARDING_SNOOZE_DAYS em vez de ficar escondido pra sempre.
  const ONBOARDING_SNOOZE_DAYS = 7;
  const dismissedRecently =
    !!currentUser?.onboardingDismissedAt &&
    daysBetween(new Date(), currentUser.onboardingDismissedAt) < ONBOARDING_SNOOZE_DAYS;
  const showOnboarding = !dismissedRecently && onboardingSteps.some((s) => !s.done);

  // Agrupado no banco (antes carregava todos os não lidos para montar 3 itens).
  // Só o tipo com 1 alerta precisa do texto dele; os demais usam o plural.
  const topGrupos = alertas
    .map((g) => ({ type: g.type as string, count: g._count._all }))
    .sort(
      (a, b) =>
        TOM_ORDEM[ALERTA_TOM[a.type] ?? "ok"] - TOM_ORDEM[ALERTA_TOM[b.type] ?? "ok"] || b.count - a.count
    )
    .slice(0, 3);
  const tiposUnicos = topGrupos.filter((g) => g.count === 1 || !ALERTA_PLURAL[g.type]).map((g) => g.type);
  const mensagens = tiposUnicos.length
    ? await runWithBase(baseId, async () =>
        prisma.alert.findMany({
          where: { userId, read: false, type: { in: tiposUnicos as AlertType[] } },
          orderBy: { createdAt: "desc" },
          select: { type: true, message: true },
          take: 20,
        })
      )
    : [];
  const gruposAlerta = topGrupos.map((g) => ({
    ...g,
    id: g.type,
    latest: mensagens.find((m) => m.type === g.type)?.message ?? "",
  }));

  const muted = { color: "var(--color-text-secondary)" };
  const ruleStrong = { borderColor: "var(--color-text)" };
  const ruleSoft = { borderColor: "var(--color-border)" };

  return (
    <div>
      <section
        className="grid gap-6 border-b pb-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-10"
        style={ruleStrong}
      >
        <div>
          <p className="eyebrow mb-3" style={{ color: "var(--color-primary-ink)" }}>
            {DIAS[diaSemana]} · {now.getDate()} de {MESES[now.getMonth()]} · {saudacao(now)}, {firstName}
          </p>
          <h1
            className="max-w-3xl text-3xl font-bold uppercase leading-[0.95] sm:text-4xl md:text-5xl"
            style={{ color: "var(--color-heading)" }}
          >
            O que você <span style={{ color: "var(--color-primary-display)" }}>prometeu</span> precisa acontecer.
          </h1>
        </div>
        <div className="border-l-4 pl-4" style={{ borderColor: "var(--color-accent)" }}>
          <p className="eyebrow">Check-in diário · {checkinPendente ? "pendente" : "em dia"}</p>
          <p className="mt-1 text-xs" style={muted}>
            {checkinPendente
              ? "Responda as perguntas do dia — leva poucos minutos."
              : "Nenhum check-in esperando resposta agora."}
          </p>
          <Link
            href={checkinPendente ? `/checkin/${checkinPendente.id}` : "/checkin"}
            className="btn-primary mt-3 flex h-8 w-full items-center justify-between px-3 text-xs"
            style={{ borderRadius: "0.125rem" }}
          >
            {checkinPendente ? "Fazer check-in agora" : "Ver check-ins"} <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <section className="grid border-b sm:grid-cols-2 lg:grid-cols-12" style={ruleStrong} aria-label="Indicadores">
        <Link
          href="/tarefas"
          className="border-b py-5 sm:border-r sm:pr-5 lg:col-span-2 lg:border-b-0 hover:bg-[var(--color-hover)]"
          style={ruleSoft}
        >
          <p className="eyebrow" style={muted}>Em aberto</p>
          <p className="mt-2 font-display text-4xl font-bold" style={{ color: "var(--color-heading)" }}>{abertas}</p>
          <p className="mt-1 text-[0.6875rem]" style={muted}>
            {vencemHoje === 1 ? "1 vence hoje" : `${vencemHoje} vencem hoje`}
          </p>
        </Link>
        <Link
          href="/tarefas?status=ATRASADA"
          className="border-b py-5 sm:pl-5 lg:col-span-3 lg:border-b-0 lg:border-r hover:bg-[var(--color-hover)]"
          style={ruleSoft}
        >
          <p className="eyebrow" style={{ color: "var(--color-danger-ink)" }}>Atenção imediata</p>
          <div className="mt-2 flex items-end gap-3">
            <p className="font-display text-5xl font-bold leading-none" style={{ color: "var(--color-danger)" }}>{atrasada}</p>
            <p className="max-w-28 text-[0.6875rem] leading-tight">
              {atrasada === 1 ? "tarefa em atraso" : "tarefas em atraso"} ·{" "}
              {prorrogacoes === 1 ? "1 prorrogação" : `${prorrogacoes} prorrogações`}
            </p>
          </div>
        </Link>
        <div className="border-b py-5 sm:border-r sm:pr-5 lg:col-span-5 lg:border-b-0 lg:px-6" style={ruleSoft}>
          <p className="eyebrow" style={muted}>Taxa de entrega</p>
          <p className="mt-2 font-display text-4xl font-bold" style={{ color: "var(--color-heading)" }}>{taxaEntrega}%</p>
          <div
            className="mt-3 h-1.5"
            style={{ background: "var(--color-surface)" }}
            role="progressbar"
            aria-valuenow={taxaEntrega}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Taxa de entrega"
          >
            <div className="h-full" style={{ width: `${taxaEntrega}%`, background: "var(--color-primary)" }} />
          </div>
          <p className="mt-1 text-[0.6875rem]" style={muted}>
            {concluida} de {totalForRate} concluídas
            {taxaCheckin !== null ? ` · check-ins ${taxaCheckin}%` : ""}
          </p>
        </div>
        <div className="p-5 lg:col-span-2" style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}>
          <p className="eyebrow">Ciclo atual</p>
          <p className="mt-2 font-display text-3xl font-bold leading-none">SEM {isoWeek(now)}</p>
          <p className="mt-2 text-[0.6875rem] font-semibold">{fechamento}</p>
        </div>
      </section>

      {showOnboarding && (
        <div className="pt-8">
          <OnboardingChecklist steps={onboardingSteps} />
        </div>
      )}

      <section className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <div>
          <div className="flex items-end justify-between border-b-2 pb-3" style={ruleStrong}>
            <div>
              <p className="eyebrow" style={{ color: "var(--color-primary-ink)" }}>Compromissos em movimento</p>
              <h2 className="mt-1 text-xl font-bold uppercase">Esta semana</h2>
            </div>
            <Link href="/tarefas" className="flex h-8 items-center gap-1.5 rounded-sm px-3 text-xs font-medium hover:bg-[var(--color-hover)]">
              Ver todas <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {semana.length === 0 ? (
            <p className="py-6 text-sm" style={muted}>
              Nenhum compromisso vencendo nos próximos 7 dias.{" "}
              <Link href="/tarefas/nova" className="font-semibold hover:underline" style={{ color: "var(--color-primary-ink)" }}>
                Criar tarefa
              </Link>
            </p>
          ) : (
            <ol>
              {semana.map((task, i) => {
                const due = task.dueDate!;
                const days = Math.round((startOfDay(due).getTime() - today.getTime()) / 86400000);
                const sit =
                  task.status === "ATRASADA" || days < 0 ? SITUACAO.ATRASADA : days <= 1 ? SITUACAO.RISCO : SITUACAO.PRAZO;
                return (
                  <li
                    key={task.id}
                    className="grid gap-2 border-b border-l-4 py-3 pl-3 md:grid-cols-[1.5rem_minmax(0,1fr)_7rem_6rem] md:items-center"
                    style={{ borderBottomColor: "var(--color-border)", borderLeftColor: sit.border }}
                  >
                    <span className="text-[0.6875rem] font-semibold" style={muted}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <Link href={`/tarefas/${task.id}`} className="block truncate text-sm font-semibold hover:underline">
                        {task.title}
                      </Link>
                      <p className="text-[0.6875rem]" style={muted}>Responsável: {task.owner.name}</p>
                    </div>
                    <p className="text-xs font-medium">{prazoRelativo(due, today)}</p>
                    <p className="text-[0.625rem] font-bold tracking-wider">{sit.label}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <aside className="space-y-8">
          <div className="border-t-2 pt-3" style={ruleStrong}>
            <div className="flex items-center justify-between">
              <h2 className="eyebrow font-sans" style={{ color: "var(--color-primary-ink)" }}>Minhas metas</h2>
              <Link href="/metas" className="inline-flex min-h-6 items-center text-[0.6875rem] font-bold hover:underline" style={{ color: "var(--color-primary-ink)" }}>
                Ver metas →
              </Link>
            </div>
            {metas.length === 0 ? (
              <p className="mt-4 text-xs" style={muted}>
                Nenhuma meta em andamento.{" "}
                <Link href="/metas/nova" className="font-semibold hover:underline" style={{ color: "var(--color-primary-ink)" }}>
                  Criar meta
                </Link>
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {metas.map((m) => {
                  const pct = Math.max(0, Math.min(100, Math.round((m.currentValue / m.targetValue) * 100) || 0));
                  return (
                    <Link key={m.id} href={`/metas/${m.id}`} className="block group">
                      <div className="flex items-start justify-between gap-4 text-xs">
                        <span className="group-hover:underline">{m.title}</span>
                        <span className="font-display text-base font-bold">{pct}%</span>
                      </div>
                      <div className="mt-2 h-1" style={{ background: "var(--color-surface)" }}>
                        <div
                          className="h-full"
                          style={{
                            width: `${pct}%`,
                            background: m.status === "EM_RISCO" ? "var(--color-warning)" : "var(--color-primary)",
                          }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t-2 pt-3" style={ruleStrong}>
            <div className="flex items-center justify-between">
              <h2 className="eyebrow font-sans">Sinais de atenção</h2>
              <span
                className="font-display text-lg font-bold"
                style={{ color: alertasNaoLidos > 0 ? "var(--color-danger-ink)" : "var(--color-text-secondary)" }}
              >
                {String(alertasNaoLidos).padStart(2, "0")}
              </span>
            </div>
            <ul className="mt-4 space-y-3 text-xs">
              {gruposAlerta.length === 0 ? (
                <li className="flex gap-2" style={muted}>
                  <Check className="mt-0.5 size-3 shrink-0" style={{ color: "var(--color-success)" }} />
                  <span>Nenhum alerta pendente.</span>
                </li>
              ) : (
                gruposAlerta.map((g) => {
                  const tom = ALERTA_TOM[g.type] ?? "ok";
                  const cor = tom === "danger" ? "var(--color-danger)" : tom === "warning" ? "var(--color-warning)" : "var(--color-primary)";
                  const texto = g.count === 1 ? g.latest : (ALERTA_PLURAL[g.type]?.(g.count) ?? `${g.count}× ${g.latest}`);
                  return (
                    <li key={g.id} className="flex gap-2">
                      <Circle className="mt-1 size-2 shrink-0" aria-hidden="true" style={{ color: cor, fill: cor }} />
                      <span>{texto}</span>
                    </li>
                  );
                })
              )}
            </ul>
            <Link
              href="/alertas"
              className="mt-4 inline-flex min-h-6 items-center text-[0.6875rem] font-bold hover:underline"
              style={{ color: "var(--color-primary-ink)" }}
            >
              Ver todos os alertas →
            </Link>
          </div>
        </aside>
      </section>

      <EntregaSemanalSummaryPanel />
    </div>
  );
}

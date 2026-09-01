import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/stat-card";
import { EntregaSemanalSummaryPanel } from "@/components/entrega-semanal/summary-panel";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/onboarding-checklist";
import {
  ListChecks,
  Clock,
  Users,
  CheckCircle2,
  AlertOctagon,
  CalendarX,
  Target,
  TrendingUp,
  MessageCircleQuestion,
} from "lucide-react";

const PRIORITY_LABEL: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [
    total,
    pendente,
    emAndamento,
    aguardandoTerceiros,
    concluida,
    atrasada,
    semPrazo,
    proximosVencimentos,
    metasTotal,
    metasAtingidas,
    metasEmRisco,
    checkinsPendentes,
    checkinsRespondidos,
    activeSlots,
    currentUser,
  ] = await Promise.all([
    prisma.task.count({ where: { ownerId: userId } }),
    prisma.task.count({ where: { ownerId: userId, status: "PENDENTE" } }),
    prisma.task.count({ where: { ownerId: userId, status: "EM_ANDAMENTO" } }),
    prisma.task.count({ where: { ownerId: userId, status: "AGUARDANDO_TERCEIROS" } }),
    prisma.task.count({ where: { ownerId: userId, status: "CONCLUIDA" } }),
    prisma.task.count({ where: { ownerId: userId, status: "ATRASADA" } }),
    prisma.task.count({ where: { ownerId: userId, needsDueDate: true, dueDate: null } }),
    prisma.task.findMany({
      where: {
        ownerId: userId,
        status: { notIn: ["CONCLUIDA", "CANCELADA"] },
        dueDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.goal.count({ where: { ownerId: userId } }),
    prisma.goal.count({ where: { ownerId: userId, status: "ATINGIDA" } }),
    prisma.goal.count({ where: { ownerId: userId, status: "EM_RISCO" } }),
    prisma.checkInSession.count({ where: { userId, status: "PENDENTE" } }),
    prisma.checkInSession.count({ where: { userId, status: "RESPONDIDO" } }),
    prisma.checkInSlot.count({ where: { active: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { onboardingDismissedAt: true } }),
  ]);

  const totalForRate = total - (await prisma.task.count({ where: { ownerId: userId, status: "CANCELADA" } }));
  const taxaConclusao = totalForRate > 0 ? Math.round((concluida / totalForRate) * 100) : 0;

  const onboardingSteps: OnboardingStep[] = [
    { label: "Responda seu primeiro check-in", done: checkinsRespondidos > 0, href: "/checkin" },
    { label: "Crie sua primeira meta", done: metasTotal > 0, href: "/metas/nova" },
    ...(session!.user.role === "ADMIN"
      ? [{ label: "Configure os horários de check-in", done: activeSlots > 0, href: "/admin" }]
      : []),
  ];
  const showOnboarding = !currentUser?.onboardingDismissedAt && onboardingSteps.some((s) => !s.done);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Olá, {session!.user.name?.split(" ")[0]}</h1>
          <p style={{ color: "var(--color-text-secondary)" }}>Aqui está o seu resumo de hoje.</p>
        </div>
        {checkinsPendentes > 0 && (
          <Link href="/checkin" className="btn-accent px-4 py-2.5 text-sm flex items-center gap-2">
            <MessageCircleQuestion size={16} />
            {checkinsPendentes} check-in(s) pendente(s)
          </Link>
        )}
      </div>

      {showOnboarding && <OnboardingChecklist steps={onboardingSteps} />}

      {total === 0 && metasTotal === 0 ? (
        <div className="card p-8 text-center flex flex-col items-center gap-3">
          <ListChecks size={28} style={{ color: "var(--color-primary)" }} />
          <h2 className="font-semibold">Você ainda não tem tarefas nem metas por aqui</h2>
          <p className="text-sm max-w-sm" style={{ color: "var(--color-text-secondary)" }}>
            Comece respondendo um check-in ou criando a primeira tarefa — os indicadores deste painel aparecem
            assim que houver algo para acompanhar.
          </p>
          <Link href="/tarefas/nova" className="btn-primary px-4 py-2.5 text-sm mt-1">
            Criar minha primeira tarefa
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total de tarefas" value={total} icon={ListChecks} tone="primary" href="/tarefas" />
          <StatCard label="Pendentes" value={pendente} icon={Clock} tone="default" href="/tarefas?status=PENDENTE" />
          <StatCard label="Em andamento" value={emAndamento} icon={TrendingUp} tone="primary" href="/tarefas?status=EM_ANDAMENTO" />
          <StatCard label="Aguardando terceiros" value={aguardandoTerceiros} icon={Users} tone="warning" href="/tarefas?status=AGUARDANDO_TERCEIROS" />
          <StatCard label="Concluídas" value={concluida} icon={CheckCircle2} tone="success" href="/tarefas?status=CONCLUIDA" />
          <StatCard label="Atrasadas" value={atrasada} icon={AlertOctagon} tone="danger" href="/tarefas?status=ATRASADA" />
          <StatCard label="Sem prazo" value={semPrazo} icon={CalendarX} tone="warning" href="/tarefas?semPrazo=true" />
          <StatCard label="Taxa de conclusão" value={`${taxaConclusao}%`} icon={Target} tone="success" href="/tarefas" />
        </div>
      )}

      <EntregaSemanalSummaryPanel />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Próximos vencimentos</h2>
            <Link href="/tarefas" className="text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
              Ver todas
            </Link>
          </div>
          {proximosVencimentos.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Nenhum vencimento nos próximos 7 dias.
            </p>
          ) : (
            <ul className="space-y-3">
              {proximosVencimentos.map((task) => (
                <li key={task.id} className="flex items-center justify-between text-sm">
                  <Link href={`/tarefas/${task.id}`} className="font-medium hover:underline">
                    {task.title}
                  </Link>
                  <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {task.dueDate?.toLocaleDateString("pt-BR")} · {PRIORITY_LABEL[task.priority]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Minhas metas</h2>
            <Link href="/metas" className="text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
              Ver todas
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Link href="/metas" className="rounded-xl py-1.5 hover:bg-black/[0.03]">
              <p className="text-xl font-bold">{metasTotal}</p>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                Total
              </p>
            </Link>
            <Link href="/metas?status=ATINGIDA" className="rounded-xl py-1.5 hover:bg-black/[0.03]">
              <p className="text-xl font-bold" style={{ color: "var(--color-success)" }}>
                {metasAtingidas}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                Atingidas
              </p>
            </Link>
            <Link href="/metas?status=EM_RISCO" className="rounded-xl py-1.5 hover:bg-black/[0.03]">
              <p className="text-xl font-bold" style={{ color: "var(--color-warning)" }}>
                {metasEmRisco}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                Em risco
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

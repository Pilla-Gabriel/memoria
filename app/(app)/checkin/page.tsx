import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MessageCircleQuestion, CheckCircle2, Clock } from "lucide-react";

const KIND_LABEL: Record<string, string> = {
  DAILY: "Check-in diário",
  MONDAY_REVIEW: "Revisão de segunda-feira",
  FRIDAY_REVIEW: "Revisão de sexta-feira",
};

export default async function CheckInPage() {
  const session = await auth();
  const userId = session!.user.id;

  const sessions = await prisma.checkInSession.findMany({
    where: { userId },
    include: { slot: true, answers: true },
    orderBy: { date: "desc" },
    take: 20,
  });

  const pending = sessions.filter((s) => s.status === "PENDENTE");
  const history = sessions.filter((s) => s.status !== "PENDENTE");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Check-in</h1>
        <p style={{ color: "var(--color-text-secondary)" }}>
          Responda com sinceridade — o que você disser aqui pode virar tarefa com prazo.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-text-secondary)" }}>
          Pendentes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="card p-6 text-sm flex items-center gap-3" style={{ color: "var(--color-text-secondary)" }}>
            <CheckCircle2 size={18} style={{ color: "var(--color-success)" }} />
            Nenhum check-in pendente no momento. Muito bem!
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((s) => (
              <Link
                key={s.id}
                href={`/checkin/${s.id}`}
                className="card p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(6,169,244,0.12)", color: "var(--color-primary)" }}
                  >
                    <MessageCircleQuestion size={18} />
                  </span>
                  <div>
                    <p className="font-semibold text-sm">{KIND_LABEL[s.kind]}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      {s.slot ? s.slot.label : new Date(s.date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <span className="btn-primary text-center text-sm py-2">Responder agora</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-text-secondary)" }}>
          Histórico recente
        </h2>
        <div className="card divide-y" style={{ borderColor: "var(--color-border)" }}>
          {history.length === 0 && (
            <p className="p-5 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Nenhum check-in respondido ainda.
            </p>
          )}
          {history.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between gap-3" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center gap-3">
                <Clock size={16} style={{ color: "var(--color-text-secondary)" }} />
                <div>
                  <p className="text-sm font-medium">{KIND_LABEL[s.kind]}</p>
                  <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {new Date(s.date).toLocaleDateString("pt-BR")} · {s.answers.length} resposta(s)
                  </p>
                </div>
              </div>
              <Link href={`/checkin/${s.id}`} className="text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
                Ver
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

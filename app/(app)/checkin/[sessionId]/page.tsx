"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Sparkles, Mic, Square, Send, CalendarClock } from "lucide-react";
import { dateInputToISOString } from "@/lib/date";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { NotFoundState } from "@/components/ui/not-found-state";
import { ErrorBanner } from "@/components/ui/error-banner";

type Question = { id: string; text: string; category: string; order: number };
type Answer = {
  id: string;
  questionId: string;
  text: string;
  isActionable: boolean;
  convertedTaskId: string | null;
  question: Question;
};
type SessionData = {
  id: string;
  date: string;
  status: "PENDENTE" | "RESPONDIDO" | "IGNORADO";
  kind: "DAILY" | "MONDAY_REVIEW" | "FRIDAY_REVIEW";
  answers: Answer[];
};

const KIND_LABEL: Record<string, string> = {
  DAILY: "Check-in diário",
  MONDAY_REVIEW: "Revisão de segunda-feira",
  FRIDAY_REVIEW: "Revisão de sexta-feira",
};

export default function CheckInSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const router = useRouter();
  const { sessionId } = usePromise(params);

  const [data, setData] = useState<{ session: SessionData; questions: Question[] } | null>(null);
  const [transcript, setTranscript] = useState<{ question: Question; text: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftText, setDraftText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechRecognition("pt-BR");
  const micEngagedRef = useRef(false);
  const prevIndexRef = useRef(currentIndex);

  async function load() {
    const res = await fetch(`/api/checkin/${sessionId}`);
    // A resposta de erro não tem "session": ler data.session derrubava a tela.
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
  }, [transcript, currentIndex]);

  // Depois que o usuário liga o microfone pela primeira vez (gesto exigido pelo
  // navegador para conceder permissão), reativa a escuta sozinho a cada nova
  // pergunta — sem exigir um clique por rodada.
  useEffect(() => {
    const changedQuestion = prevIndexRef.current !== currentIndex;
    prevIndexRef.current = currentIndex;
    if (!changedQuestion || !micEngagedRef.current) return;
    if (!data || data.session.status !== "PENDENTE") return;
    if (!speech.isSupported) return;
    if (currentIndex >= data.questions.length) return;
    speech.start((chunk) => setDraftText((prev) => (prev ? `${prev} ${chunk}` : chunk)));
    return () => speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  function concludeCurrentQuestion() {
    const questions = data?.questions ?? [];
    const question = questions[currentIndex];
    if (!question) return;

    speech.stop();
    const text = draftText.trim() || "Nada a registrar.";
    setTranscript((prev) => [...prev, { question, text }]);
    setDraftText("");
    setCurrentIndex((i) => i + 1);
  }

  // "Voltar" da referência: devolve a última resposta para edição.
  function goBackQuestion() {
    if (currentIndex === 0 || transcript.length === 0) return;
    speech.stop();
    const last = transcript[transcript.length - 1];
    setTranscript((prev) => prev.slice(0, -1));
    setDraftText(last.text === "Nada a registrar." ? "" : last.text);
    setCurrentIndex((i) => i - 1);
    // Na 1ª pergunta o próprio "Voltar" fica desativado e o foco caía no
    // <body> — o próximo Tab recomeçava do topo da página.
    requestAnimationFrame(() => answerRef.current?.focus());
  }

  function toggleListening() {
    if (speech.listening) {
      speech.stop();
      return;
    }
    micEngagedRef.current = true;
    speech.start((chunk) => {
      setDraftText((prev) => (prev ? `${prev} ${chunk}` : chunk));
    });
  }

  async function finalizeCheckIn() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    const answers = transcript.map((t) => ({ questionId: t.question.id, text: t.text }));
    const res = await fetch(`/api/checkin/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setSubmitting(false);
    submittingRef.current = false;
    // 409 = já respondido (outra aba ou clique duplo): recarregar mostra o resultado.
    if (!res.ok && res.status !== 409) {
      const json = await res.json().catch(() => ({}));
      setSubmitError(json.error ?? "Não foi possível enviar o check-in. Suas respostas continuam aqui; tente de novo.");
      return;
    }
    await load();
    router.refresh();
  }

  const hasUnsentAnswers =
    data?.session.status === "PENDENTE" && (transcript.length > 0 || draftText.trim().length > 0);
  useUnsavedChanges(hasUnsentAnswers);

  if (notFound) {
    return <NotFoundState title="Check-in não encontrado" backHref="/checkin" backLabel="Voltar para check-ins" />;
  }

  if (loading || !data) {
    return <p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>;
  }

  const { session, questions } = data;
  const isPending = session.status === "PENDENTE";
  const actionable = session.answers.filter((a) => a.isActionable);
  const pendingConversion = actionable.filter((a) => !a.convertedTaskId);
  // Sem nenhuma pergunta ativa, "Finalizar check-in" viraria um clique vazio
  // que marca a sessão como respondida sem nada de fato registrado — a mesma
  // brecha de accountability que os alertas de tarefa/meta já fecham, só que
  // por uma porta que a personalização de perguntas abriu. Em vez de deixar
  // "concluir", aponta pra onde resolver.
  const noActiveQuestions = isPending && questions.length === 0;
  const allAnswered = currentIndex >= questions.length;
  const progress = questions.length ? (Math.min(currentIndex + 1, questions.length) / questions.length) * 100 : 0;
  const sessionDate = new Date(session.date);
  const dateLabel = sessionDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const muted = { color: "var(--color-text-secondary)" };

  return (
    <div className={isPending && !noActiveQuestions ? "space-y-6" : "max-w-2xl space-y-6"}>
      <div>
        <Link href="/checkin" className="inline-flex min-h-6 items-center text-sm font-semibold" style={{ color: "var(--color-primary-ink)" }}>
          ← Voltar
        </Link>
        <h1 className="page-title mt-2">{KIND_LABEL[session.kind]}</h1>
        <p className="first-letter:uppercase">
          {dateLabel}
          {isPending && questions.length > 0
            ? ` · ${questions.length} ${questions.length === 1 ? "pergunta" : "perguntas"}`
            : ""}
        </p>
      </div>

      {noActiveQuestions ? (
        <div className="card p-5 flex items-start gap-3 text-sm" style={{ background: "var(--badge-danger-bg)" }}>
          <AlertTriangle size={18} style={{ color: "var(--badge-danger-fg)" }} className="shrink-0 mt-0.5" />
          <span>
            Você não tem nenhuma pergunta ativa para este tipo de check-in, então não há o que responder aqui. Ative
            ou crie ao menos uma em{" "}
            <Link href="/configuracoes" className="font-semibold underline">
              Configurações
            </Link>{" "}
            para continuar.
          </span>
        </div>
      ) : isPending ? (
        // Layout do check-in da referência (Lovable weekly-wrapup,
        // src/routes/check-in.tsx): pergunta com barra de progresso à
        // esquerda, respostas + envio à direita.
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="card overflow-hidden">
            <div
              className="h-1.5 w-full"
              style={{ background: "var(--color-surface)" }}
              role="progressbar"
              aria-label="Progresso do check-in"
              aria-valuemin={0}
              aria-valuemax={questions.length}
              aria-valuenow={Math.min(currentIndex, questions.length)}
            >
              <div
                className="h-full transition-all motion-reduce:transition-none"
                style={{ width: `${progress}%`, backgroundImage: "var(--gradient-brand)" }}
              />
            </div>
            <div className="p-6 md:p-8">
              {!allAnswered ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    concludeCurrentQuestion();
                  }}
                >
                  {/* O foco fica na caixa de texto ao avançar: sem a região viva,
                      quem usa leitor de tela não ouvia a pergunta seguinte. */}
                  <div aria-live="polite" aria-atomic="true">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-heading)" }}>
                      Pergunta {currentIndex + 1} de {questions.length}
                    </p>
                    <h2 id="checkin-question" className="mt-2 text-xl font-bold">
                      {questions[currentIndex].text}
                    </h2>
                  </div>
                  <p className="mt-1 text-sm" style={muted}>
                    Responda do seu jeito — o que parecer compromisso pode virar tarefa com prazo.
                  </p>

                  <textarea
                    ref={answerRef}
                    autoFocus
                    aria-label="Sua resposta"
                    aria-describedby="checkin-question"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        concludeCurrentQuestion();
                      }
                    }}
                    placeholder={
                      speech.isSupported ? "Escreva sua resposta ou grave um áudio..." : "Escreva sua resposta..."
                    }
                    className="mt-5 min-h-36 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none"
                    style={{ borderColor: speech.listening ? "var(--color-primary)" : "var(--color-border)" }}
                  />

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {speech.isSupported && (
                      <button
                        type="button"
                        onClick={toggleListening}
                        className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium shadow-sm"
                        style={
                          speech.listening
                            ? { background: "var(--color-danger-strong)", color: "var(--color-on-danger)" }
                            : { background: "var(--color-surface)", color: "var(--color-text)" }
                        }
                      >
                        {speech.listening ? <Square className="size-4" /> : <Mic className="size-4" />}
                        {speech.listening ? "Parar gravação" : "Responder por voz"}
                      </button>
                    )}
                    {speech.listening && (
                      <span className="flex items-center gap-2 text-sm" style={muted}>
                        <span
                          className="size-2 animate-pulse rounded-full motion-reduce:animate-none"
                          style={{ background: "var(--color-danger)" }}
                        />
                        Gravando...
                      </span>
                    )}

                    <div className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={goBackQuestion}
                        disabled={currentIndex === 0}
                        className="h-9 rounded-md px-4 text-sm font-medium hover:bg-[var(--color-hover)] disabled:pointer-events-none disabled:opacity-50"
                      >
                        Voltar
                      </button>
                      <button type="submit" className="btn-primary h-9 px-4 text-sm">
                        {currentIndex === questions.length - 1 ? "Concluir" : "Próxima"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-heading)" }}>
                    Tudo respondido
                  </p>
                  <h2 className="mt-2 text-xl font-bold">Revise e envie seu check-in</h2>
                  <p className="mt-1 text-sm" style={muted}>
                    Confira as respostas ao lado. Depois de enviar, as que parecerem compromisso pedem um prazo para virar
                    tarefa.
                  </p>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={goBackQuestion}
                      className="h-9 rounded-md px-4 text-sm font-medium hover:bg-[var(--color-hover)]"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="card p-6">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4" style={{ color: "var(--color-primary)" }} aria-hidden="true" />
              <h2 className="font-display text-base font-bold">Suas respostas</h2>
            </div>
            <p className="mt-1 text-sm" style={muted}>
              Cada resposta que parecer compromisso vira tarefa. O prazo é obrigatório.
            </p>

            <div className="mt-5 max-h-[50vh] space-y-4 overflow-y-auto">
              {transcript.length === 0 ? (
                <p className="text-sm" style={muted}>
                  As respostas aparecem aqui conforme você avança.
                </p>
              ) : (
                transcript.map((t, i) => (
                  <div key={i} className="rounded-xl border p-3" style={{ borderColor: "var(--color-border)" }}>
                    <p className="text-xs" style={muted}>
                      {t.question.text}
                    </p>
                    <p className="mt-1 text-sm">{t.text}</p>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {submitError && (
              <div className="mt-4">
                <ErrorBanner>{submitError}</ErrorBanner>
              </div>
            )}
            <button
              type="button"
              onClick={finalizeCheckIn}
              disabled={submitting || !allAnswered}
              className="btn-primary mt-4 flex h-9 w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <Send className="size-4" />
              {submitting ? "Enviando..." : "Enviar check-in"}
            </button>
            {!allAnswered && (
              <p className="mt-2 text-center text-xs" style={muted}>
                Responda as {questions.length} perguntas para enviar.
              </p>
            )}
          </section>
        </div>
      ) : session.status === "IGNORADO" ? (
        // Um check-in que passou do dia sem resposta aparecia como "concluído"
        // (achado G-05).
        <div className="card p-4 flex items-start gap-3 text-sm" style={{ background: "var(--badge-warning-bg)" }}>
          <AlertTriangle size={18} aria-hidden className="shrink-0 mt-0.5" style={{ color: "var(--badge-warning-fg)" }} />
          <span>
            Este check-in não foi respondido no dia e foi marcado como <strong>ignorado</strong>. Nenhuma resposta foi
            registrada.
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className="card p-4 flex items-center gap-3 text-sm"
            style={{
              background: pendingConversion.length ? "var(--badge-warning-bg)" : "var(--badge-success-bg)",
            }}
          >
            {pendingConversion.length ? (
              <>
                <Sparkles size={18} style={{ color: "var(--badge-warning-fg)" }} />
                <span>
                  {pendingConversion.length} resposta(s) parecem compromissos. Defina um prazo para transformá-las em
                  tarefa.
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} style={{ color: "var(--badge-success-fg)" }} />
                <span>Check-in concluído. Nenhuma pendência de conversão.</span>
              </>
            )}
          </div>

          {session.answers.map((answer) => (
            <AnswerCard key={answer.id} answer={answer} sessionId={sessionId} onConverted={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnswerCard({
  answer,
  sessionId,
  onConverted,
}: {
  answer: Answer;
  sessionId: string;
  onConverted: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [title, setTitle] = useState(answer.text.slice(0, 80));
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("MEDIA");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Trava na hora: o "disabled" só aparece na próxima renderização e cliques
  // rápidos seguidos gravavam o registro em dobro (G-02).
  const savingRef = useRef(false);

  const needsAction = answer.isActionable && !answer.convertedTaskId && !dismissed;

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!dueDate) {
      setError("O prazo é obrigatório para confirmar a tarefa.");
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const res = await fetch(`/api/checkin/${sessionId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answerId: answer.id,
        title,
        dueDate: dateInputToISOString(dueDate),
        priority,
      }),
    });
    setSaving(false);
    savingRef.current = false;
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Não foi possível criar a tarefa.");
      return;
    }
    onConverted();
  }

  return (
    <div className="card p-5">
      <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>
        {answer.question.text}
      </p>
      <p className="text-sm mb-3">{answer.text}</p>

      {answer.convertedTaskId && (
        <Link
          href={`/tarefas/${answer.convertedTaskId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: "var(--badge-success-fg)" }}
        >
          <CheckCircle2 size={14} /> Tarefa criada — ver detalhes
        </Link>
      )}

      {needsAction && (
        <form onSubmit={handleCreateTask} className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--badge-warning-fg)" }}>
            <AlertTriangle size={14} /> Isso parece um compromisso. Transformar em tarefa?
          </div>
          <input
            aria-label="Título da tarefa"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
            placeholder="Título da tarefa"
          />
          <div className="flex gap-2">
            <input
              type="date"
              required
              aria-label="Prazo da tarefa"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
            <select
              aria-label="Prioridade da tarefa"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none bg-transparent"
              style={{ borderColor: "var(--color-border)" }}
            >
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Urgente</option>
            </select>
          </div>
          {error && <p className="text-xs" style={{ color: "var(--badge-danger-fg)" }}>{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-2 text-xs disabled:opacity-60">
              {saving ? "Criando..." : "Criar tarefa"}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border"
              style={{ borderColor: "var(--color-border)" }}
            >
              Ignorar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

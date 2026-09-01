"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Sparkles, Check, MessageCircleQuestion, Mic, MicOff } from "lucide-react";
import { dateInputToISOString } from "@/lib/date";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechRecognition("pt-BR");
  const micEngagedRef = useRef(false);
  const prevIndexRef = useRef(currentIndex);

  async function load() {
    const res = await fetch(`/api/checkin/${sessionId}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
    setSubmitting(true);
    const answers = transcript.map((t) => ({ questionId: t.question.id, text: t.text }));
    await fetch(`/api/checkin/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setSubmitting(false);
    await load();
    router.refresh();
  }

  if (loading || !data) {
    return <p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>;
  }

  const { session, questions } = data;
  const isPending = session.status === "PENDENTE";
  const actionable = session.answers.filter((a) => a.isActionable);
  const pendingConversion = actionable.filter((a) => !a.convertedTaskId);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/checkin" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold mt-2">{KIND_LABEL[session.kind]}</h1>
      </div>

      {isPending ? (
        <div className="card p-4 sm:p-6 space-y-4">
          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
            {transcript.map((t, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(6,169,244,0.12)", color: "var(--color-primary)" }}
                  >
                    <MessageCircleQuestion size={15} />
                  </span>
                  <div
                    className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm max-w-[85%]"
                    style={{ background: "var(--color-bg)" }}
                  >
                    {t.question.text}
                  </div>
                </div>
                <div className="flex justify-end">
                  <div
                    className="rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm max-w-[85%] text-white"
                    style={{ background: "var(--color-primary)" }}
                  >
                    {t.text}
                  </div>
                </div>
              </div>
            ))}

            {currentIndex < questions.length && (
              <div className="flex items-start gap-2.5">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(6,169,244,0.12)", color: "var(--color-primary)" }}
                >
                  <MessageCircleQuestion size={15} />
                </span>
                <div
                  className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm max-w-[85%]"
                  style={{ background: "var(--color-bg)" }}
                >
                  {questions[currentIndex].text}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {currentIndex < questions.length ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                concludeCurrentQuestion();
              }}
              className="flex flex-col gap-2 border-t pt-4"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="relative">
                <textarea
                  autoFocus
                  rows={2}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      concludeCurrentQuestion();
                    }
                  }}
                  placeholder={
                    speech.isSupported
                      ? "Digite ou toque no microfone para falar sua resposta..."
                      : "Digite sua resposta e pressione Enter ou toque em Concluir..."
                  }
                  className="w-full rounded-xl border px-3.5 py-2.5 pr-11 text-sm outline-none"
                  style={{ borderColor: speech.listening ? "var(--color-primary)" : "var(--color-border)" }}
                />
                {speech.isSupported && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    aria-label={speech.listening ? "Parar gravação" : "Responder por voz"}
                    title={speech.listening ? "Parar gravação" : "Responder por voz"}
                    className="absolute right-2.5 top-2.5 p-1.5 rounded-full"
                    style={{
                      background: speech.listening ? "var(--color-danger)" : "rgba(6,169,244,0.12)",
                      color: speech.listening ? "#fff" : "var(--color-primary)",
                    }}
                  >
                    {speech.listening ? <MicOff size={15} /> : <Mic size={15} />}
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs flex items-center gap-1.5" style={{ color: speech.listening ? "var(--color-danger)" : "var(--color-text-secondary)" }}>
                  {speech.listening && (
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--color-danger)" }} />
                  )}
                  {speech.listening ? "Ouvindo..." : `Pergunta ${currentIndex + 1} de ${questions.length}`}
                </span>
                <button type="submit" className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
                  <Check size={15} /> Concluir pergunta
                </button>
              </div>
            </form>
          ) : (
            <div className="border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
              <button
                onClick={finalizeCheckIn}
                disabled={submitting}
                className="btn-primary w-full py-2.5 text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                {submitting ? "Enviando..." : "Finalizar check-in"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className="card p-4 flex items-center gap-3 text-sm"
            style={{
              background: pendingConversion.length ? "rgba(245,158,11,0.08)" : "rgba(34,197,94,0.08)",
            }}
          >
            {pendingConversion.length ? (
              <>
                <Sparkles size={18} style={{ color: "var(--color-warning)" }} />
                <span>
                  {pendingConversion.length} resposta(s) parecem compromissos. Defina um prazo para transformá-las em
                  tarefa.
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} style={{ color: "var(--color-success)" }} />
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

  const needsAction = answer.isActionable && !answer.convertedTaskId && !dismissed;

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!dueDate) {
      setError("O prazo é obrigatório para confirmar a tarefa.");
      return;
    }
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
          style={{ color: "var(--color-success)" }}
        >
          <CheckCircle2 size={14} /> Tarefa criada — ver detalhes
        </Link>
      )}

      {needsAction && (
        <form onSubmit={handleCreateTask} className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--color-warning)" }}>
            <AlertTriangle size={14} /> Isso parece um compromisso. Transformar em tarefa?
          </div>
          <input
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
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
            <select
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
          {error && <p className="text-xs" style={{ color: "var(--color-danger)" }}>{error}</p>}
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

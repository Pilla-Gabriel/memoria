"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Paperclip, Send, History, CalendarClock, Pencil, Trash2 } from "lucide-react";
import { StatusBadge, PriorityBadge, NeedsDueDateBadge } from "@/components/tasks/badges";
import { dateInputToISOString } from "@/lib/date";

type Person = { id: string; name: string };
type Comment = { id: string; text: string; createdAt: string; user: Person };
type Attachment = { id: string; filename: string; path: string; createdAt: string; uploadedBy: Person };
type Extension = {
  id: string;
  previousDueDate: string;
  newDueDate: string;
  justification: string;
  status: string;
  createdAt: string;
  requestedBy: Person;
  approvedBy: Person | null;
};
type AuditEntry = { id: string; action: string; field: string | null; oldValue: string | null; newValue: string | null; createdAt: string; user: { name: string } };

type TaskDetail = {
  id: string;
  displayCode: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  dueDate: string | null;
  needsDueDate: boolean;
  maxExtensions: number;
  extensionsUsed: number;
  owner: Person;
  createdBy: Person;
  comments: Comment[];
  attachments: Attachment[];
  extensionRequests: Extension[];
};

const STATUS_OPTIONS = ["PENDENTE", "EM_ANDAMENTO", "AGUARDANDO_TERCEIROS", "CONCLUIDA", "CANCELADA", "ATRASADA"];

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const { data: authSession } = useSession();
  const role = authSession?.user?.role;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [comment, setComment] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [justification, setJustification] = useState("");
  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await fetch(`/api/tasks/${id}`);
    const data = await res.json();
    setTask(data.task);
    setAuditLog(data.auditLog ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!task) return <p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>;

  async function updateStatus(status: string) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    await fetch(`/api/tasks/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: comment }),
    });
    setComment("");
    load();
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/api/tasks/${id}/attachments`, { method: "POST", body: formData });
    load();
  }

  async function requestExtension(e: React.FormEvent) {
    e.preventDefault();
    setExtensionError(null);
    if (!newDueDate || justification.trim().length < 10) {
      setExtensionError("Informe a nova data e uma justificativa com pelo menos 10 caracteres.");
      return;
    }
    const res = await fetch(`/api/tasks/${id}/extensions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newDueDate: dateInputToISOString(newDueDate), justification }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setExtensionError(json.error ?? "Não foi possível registrar a prorrogação.");
      return;
    }
    setNewDueDate("");
    setJustification("");
    load();
  }

  async function decideExtension(extId: string, decision: "APROVADA" | "REJEITADA") {
    await fetch(`/api/tasks/${id}/extensions/${extId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    load();
  }

  async function handleDelete() {
    if (!window.confirm("Excluir esta tarefa permanentemente? Essa ação não pode ser desfeita.")) return;
    setDeleting(true);
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.push("/tarefas");
  }

  const canExtend = task.status !== "CONCLUIDA" && task.status !== "CANCELADA";
  const atLimit = task.extensionsUsed >= task.maxExtensions;
  const isManager = role === "LEADER" || role === "ADMIN";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/tarefas" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          ← Voltar
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            {task.displayCode && (
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>
                {task.displayCode}
              </p>
            )}
            <h1 className="text-xl font-bold">{task.title}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            {task.needsDueDate && <NeedsDueDateBadge />}
            <Link
              href={`/tarefas/${id}/editar`}
              className="p-2 rounded-lg border"
              style={{ borderColor: "var(--color-border)" }}
              aria-label="Editar tarefa"
              title="Editar tarefa"
            >
              <Pencil size={15} />
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 rounded-lg border disabled:opacity-60"
              style={{ borderColor: "var(--color-border)", color: "var(--color-danger)" }}
              aria-label="Excluir tarefa"
              title="Excluir tarefa"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
        {task.description && <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>{task.description}</p>}

        <div className="grid sm:grid-cols-2 gap-4 text-sm mb-5">
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Responsável</p>
            <p>{task.owner.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Prazo</p>
            <p>{task.dueDate ? new Date(task.dueDate).toLocaleDateString("pt-BR") : "Não definido"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Categoria</p>
            <p>{task.category ?? "Sem categoria"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Prorrogações usadas</p>
            <p>{task.extensionsUsed} de {task.maxExtensions}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Criada por</p>
            <p>{task.createdBy.name}</p>
          </div>
        </div>

        <label className="block text-sm font-medium mb-1.5">Alterar status</label>
        <select
          value={task.status}
          onChange={(e) => updateStatus(e.target.value)}
          className="rounded-xl border px-3.5 py-2.5 text-sm outline-none bg-transparent"
          style={{ borderColor: "var(--color-border)" }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {canExtend && (
        <div className="card p-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <CalendarClock size={17} /> Solicitar prorrogação
          </h2>
          {atLimit && (
            <p className="text-xs mb-3 rounded-lg px-3 py-2" style={{ background: "rgba(245,158,11,0.1)", color: "#92400e" }}>
              Limite de prorrogações atingido. A solicitação será enviada para aprovação de um líder ou administrador.
            </p>
          )}
          <form onSubmit={requestExtension} className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
            <textarea
              rows={2}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Justificativa (obrigatória)"
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
            {extensionError && <p className="text-xs" style={{ color: "var(--color-danger)" }}>{extensionError}</p>}
            <button type="submit" className="btn-primary px-4 py-2 text-sm">
              Solicitar novo prazo
            </button>
          </form>

          {task.extensionRequests.length > 0 && (
            <div className="mt-4 space-y-2">
              {task.extensionRequests.map((ext) => (
                <div key={ext.id} className="text-xs rounded-lg border p-3" style={{ borderColor: "var(--color-border)" }}>
                  <p>
                    <strong>{ext.requestedBy.name}</strong> pediu prazo até{" "}
                    <strong>{new Date(ext.newDueDate).toLocaleDateString("pt-BR")}</strong> — {ext.justification}
                  </p>
                  <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
                    Status: {ext.status.replaceAll("_", " ")}
                    {ext.approvedBy ? ` · por ${ext.approvedBy.name}` : ""}
                  </p>
                  {isManager && ext.status === "PENDENTE_APROVACAO" && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => decideExtension(ext.id, "APROVADA")}
                        className="btn-primary px-3 py-1.5 text-xs"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => decideExtension(ext.id, "REJEITADA")}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl border"
                        style={{ borderColor: "var(--color-border)" }}
                      >
                        Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card p-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Paperclip size={17} /> Anexos
        </h2>
        <input type="file" onChange={uploadFile} className="text-sm mb-3" />
        <ul className="space-y-1.5 text-sm">
          {task.attachments.map((a) => (
            <li key={a.id}>
              <a href={a.path} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--color-primary)" }}>
                {a.filename}
              </a>{" "}
              <span style={{ color: "var(--color-text-secondary)" }}>· {a.uploadedBy.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-3">Comentários</h2>
        <div className="space-y-3 mb-4">
          {task.comments.map((c) => (
            <div key={c.id} className="text-sm">
              <p>
                <strong>{c.user.name}</strong>{" "}
                <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {new Date(c.createdAt).toLocaleString("pt-BR")}
                </span>
              </p>
              <p>{c.text}</p>
            </div>
          ))}
          {task.comments.length === 0 && (
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Nenhum comentário ainda.
            </p>
          )}
        </div>
        <form onSubmit={submitComment} className="flex gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Escreva um comentário..."
            className="flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <button type="submit" className="btn-primary px-4" aria-label="Enviar">
            <Send size={16} />
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <History size={17} /> Histórico
        </h2>
        <ul className="space-y-2 text-xs">
          {auditLog.map((entry) => (
            <li key={entry.id} style={{ color: "var(--color-text-secondary)" }}>
              {new Date(entry.createdAt).toLocaleString("pt-BR")} — {entry.user.name}: {entry.action.replaceAll("_", " ")}
              {entry.field ? ` (${entry.field}: ${entry.oldValue ?? "-"} → ${entry.newValue ?? "-"})` : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

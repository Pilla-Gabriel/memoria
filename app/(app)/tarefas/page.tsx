"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { StatusBadge, PriorityBadge, NeedsDueDateBadge } from "@/components/tasks/badges";
import { MultiSelect } from "@/components/ui/multi-select";

type Task = {
  id: string;
  displayCode: string | null;
  title: string;
  status: string;
  priority: string;
  category: string | null;
  origin: string;
  dueDate: string | null;
  needsDueDate: boolean;
  createdAt: string;
  owner: { id: string; name: string };
};

const STATUS_OPTIONS = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "AGUARDANDO_TERCEIROS", label: "Aguardando terceiros" },
  { value: "CONCLUIDA", label: "Concluída" },
  { value: "ATRASADA", label: "Atrasada" },
  { value: "CANCELADA", label: "Cancelada" },
];

const PRIORITY_OPTIONS = [
  { value: "BAIXA", label: "Baixa" },
  { value: "MEDIA", label: "Média" },
  { value: "ALTA", label: "Alta" },
  { value: "URGENTE", label: "Urgente" },
];

const ORIGIN_OPTIONS = [
  { value: "MANUAL", label: "Manual" },
  { value: "CHECKIN", label: "Check-in" },
  { value: "REVISAO_SEMANAL", label: "Revisão semanal" },
];

const ORIGIN_LABEL: Record<string, string> = { MANUAL: "Manual", CHECKIN: "Check-in", REVISAO_SEMANAL: "Revisão semanal" };

type SortKey = "displayCode" | "title" | "category" | "origin" | "owner" | "priority" | "status" | "dueDate";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "displayCode", label: "Código" },
  { key: "title", label: "Tarefa" },
  { key: "category", label: "Categoria" },
  { key: "origin", label: "Origem" },
  { key: "owner", label: "Responsável" },
  { key: "priority", label: "Prioridade" },
  { key: "status", label: "Status" },
  { key: "dueDate", label: "Prazo" },
];

function TarefasList() {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<string[]>(() => {
    const s = searchParams.get("status");
    return s ? [s] : [];
  });
  const [priorities, setPriorities] = useState<string[]>([]);
  const [categoriesFilter, setCategoriesFilter] = useState<string[]>([]);
  const [origins, setOrigins] = useState<string[]>([]);
  const [semPrazo, setSemPrazo] = useState(() => searchParams.get("semPrazo") === "true");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"mine" | "team">(() => (searchParams.get("scope") === "team" ? "team" : "mine"));
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/admin/task-categories")
      .then((r) => r.json())
      .then((data) => {
        const active = (data.categories ?? []).filter((c: { active: boolean }) => c.active);
        setCategoryOptions(active.map((c: { name: string }) => ({ value: c.name, label: c.name })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (statuses.length) qs.set("status", statuses.join(","));
    if (priorities.length) qs.set("priority", priorities.join(","));
    if (categoriesFilter.length) qs.set("category", categoriesFilter.join(","));
    if (origins.length) qs.set("origin", origins.join(","));
    if (semPrazo) qs.set("semPrazo", "true");
    qs.set("scope", scope);
    fetch(`/api/tasks?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks ?? []))
      .finally(() => setLoading(false));
  }, [statuses, priorities, categoriesFilter, origins, semPrazo, scope]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortValue(t: Task, key: SortKey): string | number {
    switch (key) {
      case "displayCode":
        return t.displayCode ?? "";
      case "title":
        return t.title.toLowerCase();
      case "category":
        return (t.category ?? "").toLowerCase();
      case "origin":
        return ORIGIN_LABEL[t.origin] ?? t.origin;
      case "owner":
        return t.owner.name.toLowerCase();
      case "priority":
        return t.priority;
      case "status":
        return t.status;
      case "dueDate":
        return t.dueDate ? new Date(t.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    }
  }

  const filtered = useMemo(() => {
    const list = tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
    const sorted = [...list].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, search, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Tarefas</h1>
        <Link href="/tarefas/nova" className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2 w-fit">
          <Plus size={16} /> Nova tarefa
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-secondary)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full rounded-xl border pl-9 pr-3 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>
        <MultiSelect label="Status" options={STATUS_OPTIONS} selected={statuses} onChange={setStatuses} />
        <MultiSelect label="Prioridade" options={PRIORITY_OPTIONS} selected={priorities} onChange={setPriorities} />
        <MultiSelect label="Categoria" options={categoryOptions} selected={categoriesFilter} onChange={setCategoriesFilter} />
        <MultiSelect label="Origem" options={ORIGIN_OPTIONS} selected={origins} onChange={setOrigins} />
        <button
          onClick={() => setSemPrazo((v) => !v)}
          className="rounded-xl border px-3 py-2.5 text-sm font-medium"
          style={{
            borderColor: "var(--color-border)",
            background: semPrazo ? "var(--color-warning)" : "transparent",
            color: semPrazo ? "#fff" : "var(--color-text)",
          }}
        >
          Sem prazo
        </button>
        <div className="flex rounded-xl border overflow-hidden text-sm" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={() => setScope("mine")}
            className="px-3 py-2.5 font-medium"
            style={{
              background: scope === "mine" ? "var(--color-primary)" : "transparent",
              color: scope === "mine" ? "#fff" : "var(--color-text)",
            }}
          >
            Minhas
          </button>
          <button
            onClick={() => setScope("team")}
            className="px-3 py-2.5 font-medium"
            style={{
              background: scope === "team" ? "var(--color-primary)" : "transparent",
              color: scope === "team" ? "#fff" : "var(--color-text)",
            }}
          >
            Equipe
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: "var(--color-border)" }}>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="p-4 font-semibold whitespace-nowrap">
                    <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:opacity-70">
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp size={13} />
                        ) : (
                          <ArrowDown size={13} />
                        )
                      ) : (
                        <ArrowUpDown size={13} style={{ opacity: 0.35 }} />
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMNS.length} className="p-6 text-center" style={{ color: "var(--color-text-secondary)" }}>
                    Carregando...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="p-6 text-center" style={{ color: "var(--color-text-secondary)" }}>
                    Nenhuma tarefa encontrada.
                  </td>
                </tr>
              )}
              {filtered.map((task) => (
                <tr key={task.id} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                  <td className="p-4 whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                    {task.displayCode ?? "—"}
                  </td>
                  <td className="p-4">
                    <Link href={`/tarefas/${task.id}`} className="font-medium hover:underline">
                      {task.title}
                    </Link>
                  </td>
                  <td className="p-4" style={{ color: "var(--color-text-secondary)" }}>
                    {task.category ?? "—"}
                  </td>
                  <td className="p-4" style={{ color: "var(--color-text-secondary)" }}>
                    {ORIGIN_LABEL[task.origin] ?? task.origin}
                  </td>
                  <td className="p-4" style={{ color: "var(--color-text-secondary)" }}>
                    {task.owner.name}
                  </td>
                  <td className="p-4">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="p-4">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString("pt-BR") : <NeedsDueDateBadge />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function TarefasPage() {
  return (
    <Suspense fallback={<p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>}>
      <TarefasList />
    </Suspense>
  );
}

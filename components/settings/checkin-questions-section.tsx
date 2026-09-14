"use client";

import { useState } from "react";
import { PersonalizableSection, type PersonalizableItem } from "@/components/settings/personalizable-section";

type Question = PersonalizableItem & { text: string; category: string; order: number };

export function CheckInQuestionsSection({
  currentUserId,
  mode,
}: {
  currentUserId: string;
  mode: "personal" | "default";
}) {
  return (
    <PersonalizableSection<Question>
      apiBase="/api/admin/checkin-questions"
      currentUserId={currentUserId}
      mode={mode}
      emptyMessage="Nenhuma pergunta cadastrada ainda."
      renderLabel={(q) => (
        <span>
          <span className="text-xs font-semibold uppercase mr-2" style={{ color: "var(--color-text-secondary)" }}>
            {q.category.replace("_", " ")}
          </span>
          {q.text}
        </span>
      )}
      renderForm={({ onSubmit }) => <QuestionForm onSubmit={onSubmit} />}
    />
  );
}

function QuestionForm({ onSubmit }: { onSubmit: (data: Record<string, unknown>) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("DAILY");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text) return;
    const ok = await onSubmit({ text, category });
    if (ok) setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 flex flex-wrap gap-2 items-end">
      <div className="flex-1 min-w-[220px]">
        <label className="block text-xs font-medium mb-1">Pergunta</label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--color-border)" }}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Categoria</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--color-border)" }}
        >
          <option value="DAILY">Diária</option>
          <option value="MONDAY_REVIEW">Revisão de segunda</option>
          <option value="FRIDAY_REVIEW">Revisão de sexta</option>
        </select>
      </div>
      <button type="submit" className="btn-primary px-4 py-2 text-sm">
        Adicionar
      </button>
    </form>
  );
}

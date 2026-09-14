"use client";

import { useState } from "react";
import { PersonalizableSection, type PersonalizableItem } from "@/components/settings/personalizable-section";

type Category = PersonalizableItem & { name: string };

export function TaskCategoriesSection({
  currentUserId,
  mode,
}: {
  currentUserId: string;
  mode: "personal" | "default";
}) {
  return (
    <PersonalizableSection<Category>
      apiBase="/api/admin/task-categories"
      currentUserId={currentUserId}
      mode={mode}
      emptyMessage="Nenhuma categoria cadastrada ainda."
      renderLabel={(c) => <span>{c.name}</span>}
      renderForm={({ onSubmit }) => <CategoryForm onSubmit={onSubmit} />}
    />
  );
}

function CategoryForm({ onSubmit }: { onSubmit: (data: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    const ok = await onSubmit({ name: name.trim() });
    if (ok) {
      setName("");
    } else {
      setError("Essa categoria já existe.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 flex flex-wrap gap-2 items-end">
      <div className="flex-1 min-w-[220px]">
        <label className="block text-xs font-medium mb-1">Nome da categoria</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Cliente, Interno, Comercial..."
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--color-border)" }}
        />
      </div>
      <button type="submit" className="btn-primary px-4 py-2 text-sm">
        Adicionar
      </button>
      {error && (
        <p className="w-full text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </form>
  );
}

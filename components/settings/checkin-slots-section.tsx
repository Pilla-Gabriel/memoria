"use client";

import { useState } from "react";
import { PersonalizableSection, type PersonalizableItem } from "@/components/settings/personalizable-section";

type Slot = PersonalizableItem & { time: string; label: string };

export function CheckInSlotsSection({ currentUserId, mode }: { currentUserId: string; mode: "personal" | "default" }) {
  return (
    <PersonalizableSection<Slot>
      apiBase="/api/admin/checkin-slots"
      currentUserId={currentUserId}
      mode={mode}
      emptyMessage="Nenhum horário cadastrado ainda."
      renderLabel={(s) => (
        <span className="font-medium">
          {s.time} — {s.label}
        </span>
      )}
      renderForm={({ onSubmit }) => <SlotForm onSubmit={onSubmit} />}
    />
  );
}

function SlotForm({ onSubmit }: { onSubmit: (data: Record<string, unknown>) => Promise<boolean> }) {
  const [time, setTime] = useState("");
  const [label, setLabel] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!time || !label) return;
    const ok = await onSubmit({ time, label });
    if (ok) {
      setTime("");
      setLabel("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 flex flex-wrap gap-2 items-end">
      <div>
        <label htmlFor="checkin-slot-time" className="block text-xs font-medium mb-1">Horário</label>
        <input
          id="checkin-slot-time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--color-border)" }}
        />
      </div>
      <div className="flex-1 min-w-[160px]">
        <label htmlFor="checkin-slot-label" className="block text-xs font-medium mb-1">Rótulo</label>
        <input
          id="checkin-slot-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex.: Check-in da manhã"
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--color-border)" }}
        />
      </div>
      <button type="submit" className="btn-primary px-4 py-2 text-sm">
        Adicionar
      </button>
    </form>
  );
}

"use client";

import { dateInputValueInDays } from "@/lib/date";

const PRESETS = [
  { label: "Hoje", offset: 0 },
  { label: "Amanhã", offset: 1 },
  { label: "Semana que vem", offset: 7 },
];

export function DateQuickPicks({ onPick }: { onPick: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onPick(dateInputValueInDays(p.offset))}
          className="text-xs font-medium px-2.5 py-1 rounded-full border"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

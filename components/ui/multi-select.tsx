"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export type MultiSelectOption = { value: string; label: string };

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const summary = selected.length === 0 ? label : `${label} (${selected.length})`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-xl border px-3 py-2.5 text-sm outline-none bg-transparent flex items-center gap-1.5"
        style={{
          borderColor: selected.length ? "var(--color-primary)" : "var(--color-border)",
          color: selected.length ? "var(--color-primary)" : "var(--color-text)",
        }}
      >
        {summary}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1.5 min-w-[200px] max-h-64 overflow-y-auto rounded-xl border shadow-lg py-1.5"
          style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
        >
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Nenhuma opção.
            </p>
          )}
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-black/[0.03]"
              >
                <span
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0 border"
                  style={{
                    borderColor: checked ? "var(--color-primary)" : "var(--color-border)",
                    background: checked ? "var(--color-primary)" : "transparent",
                  }}
                >
                  {checked && <Check size={11} color="#fff" />}
                </span>
                {opt.label}
              </button>
            );
          })}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-2 text-xs font-semibold border-t mt-1"
              style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-border)" }}
            >
              Limpar seleção
            </button>
          )}
        </div>
      )}
    </div>
  );
}

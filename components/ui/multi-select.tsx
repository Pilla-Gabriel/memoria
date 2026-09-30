"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export type MultiSelectOption = { value: string; label: string };

// Botão que abre uma lista de caixas de marcar. Antes não expunha nada ao
// leitor de tela: nem se a lista estava aberta, nem o que estava marcado
// (auditoria Impeccable 2026-09-29). `context` desambigua quando há várias
// na mesma tela (ex.: "Bases" em cada linha da Administração).
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  context,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  context?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || !ref.current?.contains(document.activeElement)) return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
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
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={context ? `${summary}, ${context}` : undefined}
        className="rounded-xl border px-3 py-2.5 text-sm outline-none bg-transparent flex items-center gap-1.5"
        style={{
          borderColor: selected.length ? "var(--color-primary)" : "var(--color-border)",
          color: selected.length ? "var(--badge-primary-fg)" : "var(--color-text)",
        }}
      >
        {summary}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={context ? `${label}, ${context}` : label}
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
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(opt.value)}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--color-hover)]"
              >
                <span
                  aria-hidden="true"
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0 border"
                  style={{
                    borderColor: checked ? "var(--color-primary)" : "var(--color-border)",
                    background: checked ? "var(--color-primary)" : "transparent",
                  }}
                >
                  {checked && <Check size={11} style={{ color: "var(--color-on-primary)" }} />}
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

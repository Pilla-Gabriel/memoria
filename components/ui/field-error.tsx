"use client";

import { useEffect } from "react";
import type { FormError } from "@/lib/form-error";

function errorIdFor(inputId: string) {
  return `${inputId}-error`;
}

export function fieldErrorProps(error: FormError | null, field: string, inputId: string) {
  return error?.field === field ? { "aria-invalid": true, "aria-describedby": errorIdFor(inputId) } : {};
}

export function FieldError({ error, field, inputId }: { error: FormError | null; field: string; inputId: string }) {
  if (error?.field !== field) return null;
  return (
    <p id={errorIdFor(inputId)} className="text-xs font-medium mt-1.5" style={{ color: "var(--badge-danger-fg)" }}>
      {error.message}
    </p>
  );
}

// Erro que não pertence a nenhum campo deste formulário (rede, permissão,
// regra de negócio) — esse continua no banner.
export function bannerMessage(error: FormError | null, fieldIds: Record<string, string>) {
  if (!error) return null;
  return error.field && fieldIds[error.field] ? null : error.message;
}

export function useFocusFieldError(error: FormError | null, fieldIds: Record<string, string>) {
  useEffect(() => {
    const id = error?.field ? fieldIds[error.field] : undefined;
    if (id) document.getElementById(id)?.focus();
  }, [error, fieldIds]);
}

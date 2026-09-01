"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Check, Sparkles } from "lucide-react";

export type OnboardingStep = { label: string; done: boolean; href: string };

export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  if (dismissed) return null;

  async function dismiss() {
    setDismissing(true);
    await fetch("/api/me/onboarding", { method: "POST" });
    setDismissing(false);
    setDismissed(true);
    router.refresh();
  }

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="card p-5" style={{ borderColor: "var(--color-primary)" }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "var(--color-primary)" }} />
          <h2 className="font-semibold">
            Primeiros passos
            <span className="font-normal text-sm ml-2" style={{ color: "var(--color-text-secondary)" }}>
              {doneCount}/{steps.length}
            </span>
          </h2>
        </div>
        <button
          onClick={dismiss}
          disabled={dismissing}
          className="p-1 rounded-full hover:bg-black/5 shrink-0 disabled:opacity-60"
          aria-label="Dispensar"
          title="Dispensar"
        >
          <X size={16} style={{ color: "var(--color-text-secondary)" }} />
        </button>
      </div>
      <ul className="space-y-2">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className="flex items-center gap-2.5 text-sm rounded-lg px-2 py-1.5 -mx-2 hover:bg-black/[0.03]"
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: step.done ? "var(--color-success)" : "transparent",
                  border: step.done ? "none" : "1.5px solid var(--color-border)",
                }}
              >
                {step.done && <Check size={12} color="#fff" />}
              </span>
              <span style={{ textDecoration: step.done ? "line-through" : "none", opacity: step.done ? 0.6 : 1 }}>
                {step.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

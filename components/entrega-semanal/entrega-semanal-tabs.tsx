"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AzureSprintBreakdown } from "@/components/entrega-semanal/azure-sprint-breakdown";

const TABS = [
  { key: "frentes", label: "Frentes" },
  { key: "azure-devops", label: "Azure DevOps" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// Ambos os conteúdos ficam montados o tempo todo (só escondidos via `hidden`)
// — trocar de aba não deve disparar de novo o fetch do Azure DevOps
// (components/entrega-semanal/azure-sprint-breakdown.tsx), que para
// projetos grandes como KPL pode levar vários segundos.
export function EntregaSemanalTabs({ frentesContent }: { frentesContent: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("aba") === "azure-devops" ? "azure-devops" : "frentes";
  const [tab, setTab] = useState<TabKey>(initialTab);

  function selectTab(key: TabKey) {
    setTab(key);
    const params = new URLSearchParams(searchParams.toString());
    params.set("aba", key);
    router.replace(`/entrega-semanal?${params.toString()}`, { scroll: false });
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-6 border-b" style={{ borderColor: "var(--color-border)" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectTab(t.key)}
            className="text-sm font-semibold px-4 py-2.5 -mb-px border-b-2 transition-colors"
            style={{
              borderColor: tab === t.key ? "var(--color-primary)" : "transparent",
              color: tab === t.key ? "var(--color-primary)" : "var(--color-text-secondary)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === "frentes" ? "" : "hidden"}>{frentesContent}</div>
      <div className={tab === "azure-devops" ? "" : "hidden"}>
        <AzureSprintBreakdown />
      </div>
    </div>
  );
}

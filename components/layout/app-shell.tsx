"use client";

import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import type { NavItem } from "@/lib/navigation";

type AccessibleBase = { id: string; slug: string; name: string; color: string };

// Sem menu lateral: a navegação é a faixa horizontal do cabeçalho, como no
// protótipo de referência (Lovable weekly-wrapup) — no celular ela rola de lado.
export function AppShell({
  navItems,
  name,
  role,
  unreadCount,
  activeBase,
  accessibleBases,
  children,
}: {
  navItems: NavItem[];
  name: string;
  role: string;
  unreadCount: number;
  activeBase: AccessibleBase;
  accessibleBases: AccessibleBase[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      {/* 16 paradas de Tab (barra + abas) antes do conteúdo em toda página. */}
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <Header
        navItems={navItems}
        name={name}
        role={role}
        unreadCount={unreadCount}
        activeBase={activeBase}
        accessibleBases={accessibleBases}
      />
      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 md:px-6 md:py-7">
        {children}
      </main>
    </div>
  );
}

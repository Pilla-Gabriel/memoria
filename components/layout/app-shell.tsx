"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import type { NavItem } from "@/lib/navigation";

type AccessibleBase = { id: string; slug: string; name: string; color: string };

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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <Header
        name={name}
        role={role}
        unreadCount={unreadCount}
        activeBase={activeBase}
        accessibleBases={accessibleBases}
        onMenuClick={() => setMobileOpen(true)}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar items={navItems} open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

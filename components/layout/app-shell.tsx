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
    <div className="flex min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Sidebar items={navItems} open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          name={name}
          role={role}
          unreadCount={unreadCount}
          activeBase={activeBase}
          accessibleBases={accessibleBases}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

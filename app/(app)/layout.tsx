import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { navItemsForRole } from "@/lib/navigation";
import { getActiveBaseId, getAccessibleBases } from "@/lib/active-base";
import { runWithBase } from "@/lib/base-context";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const baseId = await getActiveBaseId(session.user);
  if (!baseId) {
    redirect("/selecionar-base");
  }

  const unreadCount = await runWithBase(baseId, () =>
    prisma.alert.count({ where: { userId: session.user.id, read: false } })
  );
  const accessibleBases = await getAccessibleBases(session.user);
  const activeBase = accessibleBases.find((b) => b.id === baseId)!;

  return (
    <AppShell
      navItems={navItemsForRole(session.user.role)}
      name={session.user.name ?? session.user.email ?? "Usuário"}
      role={session.user.role}
      unreadCount={unreadCount}
      activeBase={activeBase}
      accessibleBases={accessibleBases}
    >
      {children}
    </AppShell>
  );
}

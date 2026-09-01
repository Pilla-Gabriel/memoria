import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { navItemsForRole } from "@/lib/navigation";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const unreadCount = await prisma.alert.count({
    where: { userId: session.user.id, read: false },
  });

  return (
    <AppShell
      navItems={navItemsForRole(session.user.role)}
      name={session.user.name ?? session.user.email ?? "Usuário"}
      role={session.user.role}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}

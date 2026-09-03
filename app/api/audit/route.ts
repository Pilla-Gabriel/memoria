import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVisibleUserIds, isManager } from "@/lib/rbac";
import { withBase } from "@/lib/with-base";

export const GET = withBase(async (_request, _ctx, session) => {
  if (!isManager(session.user.role)) {
    return NextResponse.json({ error: "Acesso restrito a líderes e administradores" }, { status: 403 });
  }

  const visibleIds = await getVisibleUserIds(session.user);

  const logs = await prisma.auditLog.findMany({
    where: visibleIds ? { userId: { in: visibleIds } } : undefined,
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ logs });
});

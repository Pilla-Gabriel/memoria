import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withBase } from "@/lib/with-base";

export const GET = withBase(async (_request, _ctx, session) => {
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ logs });
});

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { mirrorToAllUsers } from "@/lib/services/personalization";

// ADMIN-only: descarta toda personalização que qualquer usuário tenha feito
// em cima desta categoria padrão, revertendo todo mundo pra ver o padrão atual.
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const result = await mirrorToAllUsers(prisma.taskCategory, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ count: result.count });
}

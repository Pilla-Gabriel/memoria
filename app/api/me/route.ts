import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(2, "Informe seu nome completo"),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const existing = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name },
  });

  await logAudit({
    entityType: "User",
    entityId: user.id,
    action: "NOME_ATUALIZADO",
    field: "name",
    oldValue: existing.name,
    newValue: user.name,
    userId: session.user.id,
  });

  return NextResponse.json({ user: { id: user.id, name: user.name } });
}

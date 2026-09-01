import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { frenteSnapshotSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const frente = await prisma.frente.findUnique({ where: { id } });
  if (!frente) return NextResponse.json({ error: "Frente não encontrada" }, { status: 404 });

  const body = await request.json();
  const parsed = frenteSnapshotSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  await prisma.frenteSnapshot.create({
    data: {
      frenteId: id,
      value: parsed.data.value,
      note: parsed.data.note ?? null,
      createdById: session.user.id,
    },
  });

  const updated = await prisma.frente.update({
    where: { id },
    data: { currentValue: parsed.data.value },
  });

  await logAudit({
    entityType: "Frente",
    entityId: id,
    action: "NUMERO_ATUALIZADO",
    field: "currentValue",
    oldValue: String(frente.currentValue),
    newValue: String(parsed.data.value),
    userId: session.user.id,
  });

  return NextResponse.json({ frente: updated });
}

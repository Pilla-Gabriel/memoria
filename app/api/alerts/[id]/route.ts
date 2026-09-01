import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ read: z.boolean().optional(), snooze: z.boolean().optional() });

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert || alert.userId !== session.user.id) {
    return NextResponse.json({ error: "Alerta não encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  const data: { read?: boolean; snoozedUntil?: Date | null } = {};
  if (parsed.success && typeof parsed.data.read === "boolean") {
    data.read = parsed.data.read;
  }
  if (parsed.success && typeof parsed.data.snooze === "boolean") {
    data.snoozedUntil = parsed.data.snooze ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
  }
  if (Object.keys(data).length === 0) data.read = true;

  const updated = await prisma.alert.update({ where: { id }, data });
  return NextResponse.json({ alert: updated });
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminUserUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = adminUserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  if (parsed.data.email && parsed.data.email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (emailTaken) return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
  }

  const { password, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, active: true, leaderId: true, createdAt: true },
  });

  if (parsed.data.role && parsed.data.role !== existing.role) {
    await logAudit({
      entityType: "User",
      entityId: id,
      action: "ROLE_ALTERADO",
      field: "role",
      oldValue: existing.role,
      newValue: parsed.data.role,
      userId: session.user.id,
    });
  }
  if (password) {
    await logAudit({ entityType: "User", entityId: id, action: "SENHA_REDEFINIDA", userId: session.user.id });
  }
  if (parsed.data.name || parsed.data.email) {
    await logAudit({ entityType: "User", entityId: id, action: "ATUALIZADO", userId: session.user.id });
  }

  return NextResponse.json({ user: updated });
}

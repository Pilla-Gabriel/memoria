import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { adminUserUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { replaceUserBases } from "@/lib/user-bases";
import { withBase } from "@/lib/with-base";

// Passa por withBase porque logAudit grava AuditLog, que exige a base ativa.
// Sem isso o registro era salvo e só DEPOIS a auditoria quebrava: a API
// respondia 500, a tela dizia "Não foi possível..." e tentar de novo dava
// "e-mail já cadastrado" (os 4 usuários criados em 2026-09-10 nasceram assim,
// sem auditoria e sem base).
export const PATCH = withBase<{ params: Promise<{ id: string }> }>(async (request, ctx, session) => {
  if (session.user.role !== "ADMIN") {
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

  // Trocar perfil e desativar eram um clique só, sem trava: dava pra tirar o
  // próprio acesso de admin ou ficar sem admin nenhum (achado G-14).
  const perdeAdmin =
    existing.role === "ADMIN" &&
    existing.active &&
    (parsed.data.role === "USER" || parsed.data.active === false);
  if (perdeAdmin) {
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Você não pode remover o seu próprio acesso de administrador." },
        { status: 400 }
      );
    }
    const outrosAdmins = await prisma.user.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
    if (outrosAdmins === 0) {
      return NextResponse.json(
        { error: "Este é o último administrador ativo. Promova outra pessoa antes." },
        { status: 400 }
      );
    }
  }

  if (parsed.data.email && parsed.data.email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (emailTaken) return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
  }

  const { password, baseIds, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
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
  if (parsed.data.active !== undefined && parsed.data.active !== existing.active) {
    await logAudit({
      entityType: "User",
      entityId: id,
      action: parsed.data.active ? "REATIVADO" : "DESATIVADO",
      field: "active",
      oldValue: String(existing.active),
      newValue: String(parsed.data.active),
      userId: session.user.id,
    });
  }
  if (baseIds) {
    const result = await replaceUserBases(id, baseIds);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    if (result.before !== result.after) {
      await logAudit({
        entityType: "User",
        entityId: id,
        action: "BASES_ALTERADAS",
        field: "bases",
        oldValue: result.before,
        newValue: result.after,
        userId: session.user.id,
      });
    }
  }
  if (password) {
    await logAudit({ entityType: "User", entityId: id, action: "SENHA_REDEFINIDA", userId: session.user.id });
  }
  if (parsed.data.name || parsed.data.email) {
    await logAudit({ entityType: "User", entityId: id, action: "ATUALIZADO", userId: session.user.id });
  }

  return NextResponse.json({ user: updated });
});

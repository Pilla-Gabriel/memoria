import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminUserCreateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { replaceUserBases } from "@/lib/user-bases";
import { withBase } from "@/lib/with-base";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const [users, bases] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        userBases: { select: { baseId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.base.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    users: users.map(({ userBases, ...u }) => ({ ...u, baseIds: userBases.map((g) => g.baseId) })),
    bases,
  });
}

// Passa por withBase porque logAudit grava AuditLog, que exige a base ativa.
// Sem isso o registro era salvo e só DEPOIS a auditoria quebrava: a API
// respondia 500, a tela dizia "Não foi possível..." e tentar de novo dava
// "e-mail já cadastrado" (os 4 usuários criados em 2026-09-10 nasceram assim,
// sem auditoria e sem base).
export const POST = withBase(async (request, _ctx, session) => {
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = adminUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  if (parsed.data.role === "USER" && !parsed.data.baseIds?.length) {
    return NextResponse.json(
      { error: "Escolha ao menos uma base para este usuário.", field: "baseIds" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  await logAudit({ entityType: "User", entityId: user.id, action: "CRIADO", userId: session.user.id });

  if (parsed.data.baseIds?.length) {
    const result = await replaceUserBases(user.id, parsed.data.baseIds);
    if ("after" in result) {
      await logAudit({
        entityType: "User",
        entityId: user.id,
        action: "BASES_ALTERADAS",
        field: "bases",
        oldValue: result.before,
        newValue: result.after,
        userId: session.user.id,
      });
    }
  }

  return NextResponse.json({ user });
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { texto } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withBase } from "@/lib/with-base";

const schema = z.object({
  name: texto(2, "Informe seu nome completo"),
});

// Passa por withBase porque logAudit grava AuditLog, que exige a base ativa.
// Sem isso o registro era salvo e só DEPOIS a auditoria quebrava: a API
// respondia 500, a tela dizia "Não foi possível..." e tentar de novo dava
// "e-mail já cadastrado" (os 4 usuários criados em 2026-09-10 nasceram assim,
// sem auditoria e sem base).
export const PATCH = withBase(async (request, _ctx, session) => {
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
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { withBase } from "@/lib/with-base";
import { getScopedCheckInSession } from "@/lib/base-guards";

const convertSchema = z.object({
  answerId: z.string(),
  title: z.string().min(3, "Informe um título para a tarefa"),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime({ message: "O prazo é obrigatório para confirmar a tarefa" }),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
  category: z.string().optional().nullable(),
});

export const POST = withBase<{ params: Promise<{ sessionId: string }> }>(async (request, ctx, session, baseId) => {
  const { sessionId } = await ctx.params;
  const body = await request.json();
  const parsed = convertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  // Valida a sessão (pai) escopada pela base ativa ANTES de tocar na
  // resposta — CheckInAnswer não tem baseId próprio.
  const checkInSession = await getScopedCheckInSession(sessionId);
  if (!checkInSession || checkInSession.userId !== session.user.id) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  const answer = await prisma.checkInAnswer.findUnique({
    where: { id: parsed.data.answerId },
  });

  if (!answer || answer.sessionId !== checkInSession.id) {
    return NextResponse.json({ error: "Resposta não encontrada" }, { status: 404 });
  }
  if (answer.convertedTaskId) {
    return NextResponse.json({ error: "Esta resposta já virou uma tarefa" }, { status: 409 });
  }

  const task = await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? answer.text,
      dueDate: new Date(parsed.data.dueDate),
      priority: parsed.data.priority,
      category: parsed.data.category ?? null,
      origin: checkInSession.kind === "DAILY" ? "CHECKIN" : "REVISAO_SEMANAL",
      ownerId: session.user.id,
      createdById: session.user.id,
      baseId,
    },
  });

  await prisma.checkInAnswer.update({
    where: { id: answer.id },
    data: { convertedTaskId: task.id },
  });

  await logAudit({
    entityType: "Task",
    entityId: task.id,
    action: "CRIADA_VIA_CHECKIN",
    userId: session.user.id,
  });

  return NextResponse.json({ task });
});

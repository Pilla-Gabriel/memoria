import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const convertSchema = z.object({
  answerId: z.string(),
  title: z.string().min(3, "Informe um título para a tarefa"),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime({ message: "O prazo é obrigatório para confirmar a tarefa" }),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
  category: z.string().optional().nullable(),
});

export async function POST(request: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { sessionId } = await ctx.params;
  const body = await request.json();
  const parsed = convertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const answer = await prisma.checkInAnswer.findUnique({
    where: { id: parsed.data.answerId },
    include: { session: true },
  });

  if (!answer || answer.session.id !== sessionId || answer.session.userId !== session.user.id) {
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
      origin: answer.session.kind === "DAILY" ? "CHECKIN" : "REVISAO_SEMANAL",
      ownerId: session.user.id,
      createdById: session.user.id,
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
}

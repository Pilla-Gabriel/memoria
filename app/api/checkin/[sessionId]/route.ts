import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getQuestionsFor, isActionableAnswer } from "@/lib/services/checkin";
import { z } from "zod";

const submitSchema = z.object({
  answers: z.array(z.object({ questionId: z.string(), text: z.string().min(1) })),
});

export async function GET(request: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { sessionId } = await ctx.params;
  const checkInSession = await prisma.checkInSession.findUnique({
    where: { id: sessionId },
    include: { answers: { include: { question: true, convertedTask: true } }, slot: true },
  });

  if (!checkInSession || checkInSession.userId !== session.user.id) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  const questions = await getQuestionsFor(checkInSession.kind);

  return NextResponse.json({ session: checkInSession, questions });
}

export async function POST(request: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { sessionId } = await ctx.params;
  const checkInSession = await prisma.checkInSession.findUnique({ where: { id: sessionId } });

  if (!checkInSession || checkInSession.userId !== session.user.id) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const createdAnswers = [];
  for (const answer of parsed.data.answers) {
    const actionable = isActionableAnswer(answer.text);
    const created = await prisma.checkInAnswer.create({
      data: {
        sessionId,
        questionId: answer.questionId,
        text: answer.text,
        isActionable: actionable,
      },
      include: { question: true },
    });
    createdAnswers.push(created);
  }

  await prisma.checkInSession.update({
    where: { id: sessionId },
    data: { status: "RESPONDIDO", answeredAt: new Date() },
  });

  await prisma.alert.updateMany({
    where: { relatedType: "CheckInSession", relatedId: sessionId, read: false },
    data: { read: true },
  });

  return NextResponse.json({ answers: createdAnswers });
}

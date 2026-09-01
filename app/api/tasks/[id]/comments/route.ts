import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ text: z.string().min(1) });

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Comentário inválido" }, { status: 400 });

  const comment = await prisma.taskComment.create({
    data: { taskId: id, userId: session.user.id, text: parsed.data.text },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ comment });
}

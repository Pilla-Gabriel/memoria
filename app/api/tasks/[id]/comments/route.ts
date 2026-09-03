import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withBase } from "@/lib/with-base";
import { getScopedTask } from "@/lib/base-guards";

const schema = z.object({ text: z.string().min(1) });

export const POST = withBase<{ params: Promise<{ id: string }> }>(async (request, ctx, session) => {
  const { id } = await ctx.params;

  const task = await getScopedTask(id);
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Comentário inválido" }, { status: 400 });

  const comment = await prisma.taskComment.create({
    data: { taskId: id, userId: session.user.id, text: parsed.data.text },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ comment });
});

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { withBase } from "@/lib/with-base";
import { getScopedTask } from "@/lib/base-guards";

export const POST = withBase<{ params: Promise<{ id: string }> }>(async (request, ctx, session) => {
  const { id } = await ctx.params;

  const task = await getScopedTask(id);
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${randomUUID()}-${safeName}`;
  const dir = path.join(process.cwd(), "public", "uploads", id);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, storedName), buffer);

  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId: id,
      filename: file.name,
      path: `/uploads/${id}/${storedName}`,
      uploadedById: session.user.id,
    },
  });

  return NextResponse.json({ attachment });
});

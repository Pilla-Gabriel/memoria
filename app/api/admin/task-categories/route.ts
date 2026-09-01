import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ name: z.string().min(2, "Informe o nome da categoria") });

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const categories = await prisma.taskCategory.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const existing = await prisma.taskCategory.findUnique({ where: { name: parsed.data.name } });
  if (existing) return NextResponse.json({ error: "Essa categoria já existe" }, { status: 409 });

  const category = await prisma.taskCategory.create({ data: { name: parsed.data.name } });
  return NextResponse.json({ category });
}

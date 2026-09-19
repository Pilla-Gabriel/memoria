import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createItem, defaultsOnly, effectiveListFor } from "@/lib/services/personalization";

const schema = z.object({ name: z.string().min(2, "Informe o nome da categoria") });

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const isDefaultScope = new URL(request.url).searchParams.get("scope") === "default";
  if (isDefaultScope && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const categories = isDefaultScope
    ? await defaultsOnly(prisma.taskCategory)
    : await effectiveListFor(prisma.taskCategory, session.user.id);
  categories.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const visible = await effectiveListFor(prisma.taskCategory, session.user.id);
  const duplicate = visible.some((c) => c.name.toLowerCase() === parsed.data.name.toLowerCase());
  if (duplicate) return NextResponse.json({ error: "Essa categoria já existe" }, { status: 409 });

  const category = await createItem(prisma.taskCategory, session.user, parsed.data);
  return NextResponse.json({ category });
}

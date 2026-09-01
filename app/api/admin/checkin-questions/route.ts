import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  text: z.string().min(5),
  category: z.enum(["DAILY", "MONDAY_REVIEW", "FRIDAY_REVIEW"]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const questions = await prisma.checkInQuestion.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
  return NextResponse.json({ questions });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const question = await prisma.checkInQuestion.create({ data: parsed.data });
  return NextResponse.json({ question });
}

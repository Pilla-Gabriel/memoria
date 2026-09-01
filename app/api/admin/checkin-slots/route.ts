import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, "Use o formato HH:mm"),
  label: z.string().min(2),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const slots = await prisma.checkInSlot.findMany({ orderBy: { time: "asc" } });
  return NextResponse.json({ slots });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const slot = await prisma.checkInSlot.create({ data: parsed.data });
  return NextResponse.json({ slot });
}
